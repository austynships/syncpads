/**
 * OAuth 2.1 authorization server for agent connections (SP-15).
 *
 *  - Discovery: RFC 8414 (authorization server) + RFC 9728 (protected resource)
 *  - Dynamic client registration: RFC 7591, so Claude, ChatGPT and Cursor connect without copying keys
 *  - Authorization code + PKCE (S256 only), refresh tokens rotated on every use
 *  - Every code and token is random, stored only as a SHA-256 hash (PRD "OAuth tokens hashed")
 *
 * Each user + client pair is one agent (agents table) with its own permissions.
 * Revoking an agent revokes all of its tokens immediately.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { agents, oauthClients, oauthCodes, oauthTokens, users } from "@/db/schema";

export const ORIGIN = (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const MCP_RESOURCE = `${ORIGIN}/mcp`;
export const SCOPE = "syncpads";

const CODE_TTL_MS = 10 * 60 * 1000;
const ACCESS_TTL_S = 60 * 60;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export class OAuthError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
  toJSON() {
    return { error: this.code, error_description: this.message };
  }
}

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

// ---------- discovery ----------

export function authorizationServerMetadata() {
  return {
    issuer: ORIGIN,
    authorization_endpoint: `${ORIGIN}/oauth/authorize`,
    token_endpoint: `${ORIGIN}/oauth/token`,
    registration_endpoint: `${ORIGIN}/oauth/register`,
    revocation_endpoint: `${ORIGIN}/oauth/revoke`,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    revocation_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    scopes_supported: [SCOPE],
    service_documentation: `${ORIGIN}/agents`,
  };
}

export function protectedResourceMetadata() {
  return {
    resource: MCP_RESOURCE,
    authorization_servers: [ORIGIN],
    scopes_supported: [SCOPE],
    bearer_methods_supported: ["header"],
    resource_name: "SyncPads",
    resource_documentation: `${ORIGIN}/agents`,
  };
}

// ---------- clients (RFC 7591) ----------

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);
const BAD_SCHEMES = new Set(["javascript:", "data:", "file:", "vbscript:", "blob:", "about:"]);

/** https anywhere, http only on loopback (native apps, RFC 8252), or an app's own custom scheme. */
export function isAcceptableRedirectUri(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.hash || BAD_SCHEMES.has(url.protocol)) return false;
  if (url.protocol === "https:") return true;
  if (url.protocol === "http:") return LOOPBACK.has(url.hostname);
  return /^[a-z][a-z0-9+.-]*:$/.test(url.protocol); // e.g. cursor://
}

/** Exact match, except that loopback redirects may use any port (RFC 8252 §7.3). */
export function redirectUriMatches(registered: string[], requested: string): boolean {
  if (registered.includes(requested)) return true;
  let req: URL;
  try {
    req = new URL(requested);
  } catch {
    return false;
  }
  if (req.protocol !== "http:" || !LOOPBACK.has(req.hostname)) return false;
  return registered.some((r) => {
    try {
      const reg = new URL(r);
      return reg.protocol === "http:" && reg.hostname === req.hostname && reg.pathname === req.pathname && reg.search === req.search;
    } catch {
      return false;
    }
  });
}

export async function registerClient(body: Record<string, unknown>) {
  const uris = body.redirect_uris;
  if (!Array.isArray(uris) || uris.length === 0 || uris.length > 10 || !uris.every((u) => typeof u === "string")) {
    throw new OAuthError("invalid_redirect_uri", "redirect_uris must be a list of 1 to 10 addresses.");
  }
  if (!uris.every((u) => u.length <= 2048 && isAcceptableRedirectUri(u))) {
    throw new OAuthError("invalid_redirect_uri", "Redirect addresses must use https, a loopback http address, or an app scheme.");
  }
  const method = (body.token_endpoint_auth_method as string | undefined) ?? "none";
  if (!["none", "client_secret_post", "client_secret_basic"].includes(method)) {
    throw new OAuthError("invalid_client_metadata", `Unsupported token_endpoint_auth_method "${method}".`);
  }
  const grants = (body.grant_types as string[] | undefined) ?? ["authorization_code", "refresh_token"];
  if (!Array.isArray(grants) || grants.some((g) => !["authorization_code", "refresh_token"].includes(g))) {
    throw new OAuthError("invalid_client_metadata", "Only authorization_code and refresh_token grants are supported.");
  }
  const name = String(body.client_name ?? "").trim().slice(0, 255) || "AI agent";
  const clientUri = typeof body.client_uri === "string" && body.client_uri.startsWith("https://") ? body.client_uri.slice(0, 512) : null;

  const id = `sp_${randomToken(18)}`;
  const secret = method === "none" ? null : randomToken(32);
  await db.insert(oauthClients).values({
    id,
    name,
    redirectUris: uris as string[],
    authMethod: method as "none",
    secretHash: secret ? sha256(secret) : null,
    clientUri,
  });

  return {
    client_id: id,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_name: name,
    redirect_uris: uris,
    grant_types: grants,
    response_types: ["code"],
    token_endpoint_auth_method: method,
    scope: SCOPE,
    ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
    ...(clientUri ? { client_uri: clientUri } : {}),
  };
}

export async function getClient(clientId: string) {
  if (!clientId || clientId.length > 64) return null;
  const [client] = await db.select().from(oauthClients).where(eq(oauthClients.id, clientId));
  return client ?? null;
}

/** Checks the client's credentials at the token and revocation endpoints. */
export async function authenticateClient(form: URLSearchParams, authorization: string | null) {
  let clientId = form.get("client_id") ?? "";
  let secret = form.get("client_secret");
  if (authorization?.startsWith("Basic ")) {
    const decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
    const colon = decoded.indexOf(":");
    clientId = decodeURIComponent(decoded.slice(0, colon));
    secret = decodeURIComponent(decoded.slice(colon + 1));
  }
  const client = await getClient(clientId);
  if (!client) throw new OAuthError("invalid_client", "Unknown client.", 401);
  if (client.authMethod !== "none") {
    const ok =
      secret &&
      client.secretHash &&
      timingSafeEqual(Buffer.from(sha256(secret)), Buffer.from(client.secretHash));
    if (!ok) throw new OAuthError("invalid_client", "Client authentication failed.", 401);
  }
  return client;
}

/** "claude", "chatgpt", "cursor" or "other", from the client's name. */
export function detectClient(name: string): "claude" | "chatgpt" | "cursor" | "other" {
  const n = name.toLowerCase();
  if (n.includes("claude") || n.includes("anthropic")) return "claude";
  if (n.includes("chatgpt") || n.includes("openai")) return "chatgpt";
  if (n.includes("cursor")) return "cursor";
  return "other";
}

// ---------- authorization ----------

export type AuthorizeRequest = {
  client: NonNullable<Awaited<ReturnType<typeof getClient>>>;
  redirectUri: string;
  state: string | null;
  codeChallenge: string;
  resource: string | null;
};

/**
 * Validates an /oauth/authorize request. Errors about the client or redirect
 * address are shown to the user (never redirected); the rest are redirected
 * back to the client as OAuth errors.
 */
export async function validateAuthorizeRequest(
  params: URLSearchParams,
): Promise<{ ok: true; request: AuthorizeRequest } | { ok: false; show?: string; redirect?: string }> {
  const client = await getClient(params.get("client_id") ?? "");
  if (!client) return { ok: false, show: "This app isn't registered with SyncPads. Try connecting again from the app." };
  const redirectUri = params.get("redirect_uri") ?? (client.redirectUris.length === 1 ? client.redirectUris[0] : "");
  if (!redirectUri || !redirectUriMatches(client.redirectUris, redirectUri)) {
    return { ok: false, show: "This app asked to return to an address it didn't register. For your safety, the connection was stopped." };
  }
  const state = params.get("state");
  const fail = (error: string, description: string) => ({
    ok: false as const,
    redirect: withParams(redirectUri, { error, error_description: description, state, iss: ORIGIN }),
  });
  if (params.get("response_type") !== "code") return fail("unsupported_response_type", "Only response_type=code is supported.");
  const codeChallenge = params.get("code_challenge") ?? "";
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(codeChallenge) || params.get("code_challenge_method") !== "S256") {
    return fail("invalid_request", "PKCE with code_challenge_method=S256 is required.");
  }
  const resource = params.get("resource");
  if (resource && !isOurResource(resource)) return fail("invalid_target", "Unknown resource.");
  return { ok: true, request: { client, redirectUri, state, codeChallenge, resource } };
}

function isOurResource(resource: string) {
  const r = resource.replace(/\/$/, "");
  return r === MCP_RESOURCE || r === ORIGIN;
}

export function withParams(base: string, params: Record<string, string | null | undefined>) {
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  return url.toString();
}

/**
 * The user allowed the connection: find or create their agent for this client,
 * set its permission, and issue a one-time code.
 */
export async function approveAuthorization(userId: string, req: AuthorizeRequest, permission: "read" | "read_add") {
  const [existing] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.userId, userId), eq(agents.clientId, req.client.id), isNull(agents.revokedAt)));
  let agentId = existing?.id;
  if (existing) {
    await db.update(agents).set({ permission }).where(eq(agents.id, existing.id));
  } else {
    agentId = crypto.randomUUID();
    await db.insert(agents).values({
      id: agentId,
      userId,
      name: req.client.name,
      client: detectClient(req.client.name),
      permission,
      clientId: req.client.id,
    });
  }

  const code = randomToken(32);
  await db.insert(oauthCodes).values({
    codeHash: sha256(code),
    clientId: req.client.id,
    userId,
    agentId: agentId!,
    redirectUri: req.redirectUri,
    codeChallenge: req.codeChallenge,
    resource: req.resource,
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });
  return withParams(req.redirectUri, { code, state: req.state, iss: ORIGIN });
}

// ---------- tokens ----------

async function issueTokens(clientId: string, userId: string, agentId: string, resource: string | null) {
  const access = randomToken(32);
  const refresh = randomToken(32);
  await db.insert(oauthTokens).values([
    {
      tokenHash: sha256(access),
      kind: "access",
      clientId,
      userId,
      agentId,
      resource,
      expiresAt: new Date(Date.now() + ACCESS_TTL_S * 1000),
    },
    {
      tokenHash: sha256(refresh),
      kind: "refresh",
      clientId,
      userId,
      agentId,
      resource,
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  ]);
  return { access_token: access, token_type: "Bearer", expires_in: ACCESS_TTL_S, refresh_token: refresh, scope: SCOPE };
}

const pkceChallenge = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");

export async function exchangeCode(
  client: { id: string },
  form: URLSearchParams,
) {
  const code = form.get("code") ?? "";
  const verifier = form.get("code_verifier") ?? "";
  const [row] = await db.select().from(oauthCodes).where(eq(oauthCodes.codeHash, sha256(code)));
  if (!row || row.clientId !== client.id) throw new OAuthError("invalid_grant", "Invalid authorization code.");

  // One use only. A second use suggests the code leaked: revoke what it issued.
  const used = await db
    .update(oauthCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(oauthCodes.codeHash, row.codeHash), isNull(oauthCodes.usedAt)));
  if ((used as unknown as [{ affectedRows: number }])[0].affectedRows !== 1) {
    await revokeAgentTokens(row.agentId);
    throw new OAuthError("invalid_grant", "Authorization code was already used.");
  }
  if (row.expiresAt.getTime() < Date.now()) throw new OAuthError("invalid_grant", "Authorization code expired.");
  const redirectUri = form.get("redirect_uri");
  if (redirectUri && redirectUri !== row.redirectUri) throw new OAuthError("invalid_grant", "redirect_uri doesn't match.");
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier) || pkceChallenge(verifier) !== row.codeChallenge) {
    throw new OAuthError("invalid_grant", "PKCE verification failed.");
  }
  const resource = form.get("resource") ?? row.resource;
  if (resource && !isOurResource(resource)) throw new OAuthError("invalid_target", "Unknown resource.");

  const [agent] = await db.select().from(agents).where(eq(agents.id, row.agentId));
  if (!agent || agent.revokedAt) throw new OAuthError("invalid_grant", "This connection was revoked.");
  return issueTokens(client.id, row.userId, row.agentId, resource);
}

export async function refreshTokens(client: { id: string }, form: URLSearchParams) {
  const hash = sha256(form.get("refresh_token") ?? "");
  const [row] = await db.select().from(oauthTokens).where(and(eq(oauthTokens.tokenHash, hash), eq(oauthTokens.kind, "refresh")));
  if (!row || row.clientId !== client.id) throw new OAuthError("invalid_grant", "Invalid refresh token.");
  if (row.revokedAt) {
    // A rotated-out refresh token came back: someone may have copied it. Revoke the connection's tokens.
    await revokeAgentTokens(row.agentId);
    throw new OAuthError("invalid_grant", "Refresh token was already used.");
  }
  if (row.expiresAt.getTime() < Date.now()) throw new OAuthError("invalid_grant", "Refresh token expired.");
  const [agent] = await db.select().from(agents).where(eq(agents.id, row.agentId));
  if (!agent || agent.revokedAt) throw new OAuthError("invalid_grant", "This connection was revoked.");

  await db.update(oauthTokens).set({ revokedAt: new Date() }).where(eq(oauthTokens.tokenHash, hash));
  return issueTokens(client.id, row.userId, row.agentId, row.resource);
}

/** RFC 7009: revoke one token (silently succeeds for unknown tokens). */
export async function revokeToken(client: { id: string }, token: string) {
  await db
    .update(oauthTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(oauthTokens.tokenHash, sha256(token)), eq(oauthTokens.clientId, client.id), isNull(oauthTokens.revokedAt)));
}

export async function revokeAgentTokens(agentId: string) {
  await db.update(oauthTokens).set({ revokedAt: new Date() }).where(and(eq(oauthTokens.agentId, agentId), isNull(oauthTokens.revokedAt)));
}

export type AgentContext = {
  agentId: string;
  agentName: string;
  userId: string;
  clientId: string;
  permission: "read" | "read_add";
  autoApprove: boolean;
  plan: string;
  expiresAt: Date;
};

/** Resolves a Bearer access token to its agent, or null if invalid, expired or revoked. */
export async function verifyAccessToken(token: string): Promise<AgentContext | null> {
  if (!token || token.length > 200) return null;
  const [row] = await db
    .select({
      agentId: agents.id,
      agentName: agents.name,
      userId: agents.userId,
      clientId: oauthTokens.clientId,
      permission: agents.permission,
      autoApprove: agents.autoApprove,
      plan: users.plan,
      expiresAt: oauthTokens.expiresAt,
      resource: oauthTokens.resource,
    })
    .from(oauthTokens)
    .innerJoin(agents, eq(agents.id, oauthTokens.agentId))
    .innerJoin(users, eq(users.id, agents.userId))
    .where(
      and(
        eq(oauthTokens.tokenHash, sha256(token)),
        eq(oauthTokens.kind, "access"),
        isNull(oauthTokens.revokedAt),
        isNull(agents.revokedAt),
        gt(oauthTokens.expiresAt, new Date()),
      ),
    );
  if (!row) return null;
  if (row.resource && !isOurResource(row.resource)) return null;
  return { ...row, plan: row.plan ?? "free" };
}

/** Deletes expired codes and long-dead tokens (called by the worker's housekeeping). */
export async function pruneOAuth() {
  await db.delete(oauthCodes).where(sql`${oauthCodes.expiresAt} < NOW(3) - INTERVAL 1 DAY`);
  await db.delete(oauthTokens).where(sql`${oauthTokens.expiresAt} < NOW(3) - INTERVAL 7 DAY`);
}
