/**
 * Phase 5 against a real MariaDB (runs when TEST_DATABASE_URL is set):
 * OAuth 2.1 (registration, PKCE, codes, refresh rotation, revocation), the MCP
 * server end to end through its route handler, permissions, hidden pages,
 * page scopes, the Agent Inbox, the activity log with undo, and rate limits.
 */
import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// In-memory stand-in for the Redis commands the rate limiter uses.
const counters = new Map<string, number>();
vi.mock("@/lib/redis", () => {
  const incr = async (key: string) => {
    counters.set(key, (counters.get(key) ?? 0) + 1);
    return counters.get(key)!;
  };
  return {
    redis: {
      incr,
      expire: async () => 1,
      multi() {
        const ops: (() => Promise<unknown>)[] = [];
        const chain = {
          incr(key: string) {
            ops.push(() => incr(key));
            return chain;
          },
          expire() {
            ops.push(async () => 1);
            return chain;
          },
          async exec() {
            const out: [null, unknown][] = [];
            for (const op of ops) out.push([null, await op()]);
            return out;
          },
        };
        return chain;
      },
    },
  };
});

const url = process.env.TEST_DATABASE_URL;
const verifier = "v".repeat(20) + "erifier-for-pkce-test-1234567890abcdef";
const challenge = createHash("sha256").update(verifier).digest("base64url");

describe.skipIf(!url)("agents, OAuth and MCP", () => {
  let dbMod: typeof import("@/db");
  let schema: typeof import("@/db/schema");
  let sp: typeof import("@/server/start-page");
  let oauth: typeof import("@/server/oauth");
  let agentsMod: typeof import("@/server/agents");
  let mcp: typeof import("@/app/mcp/route");
  const user = crypto.randomUUID();
  let client: Awaited<ReturnType<typeof import("@/server/oauth").registerClient>>;
  let access = "";
  let refresh = "";
  let agentId = "";
  let homeId = "";
  let secretId = "";
  let workId = "";

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    dbMod = await import("@/db");
    schema = await import("@/db/schema");
    await (await import("@/db/migrate")).runMigrations();
    sp = await import("@/server/start-page");
    oauth = await import("@/server/oauth");
    agentsMod = await import("@/server/agents");
    mcp = await import("@/app/mcp/route");
    await dbMod.db.insert(schema.users).values({ id: user, email: `${user}@test.local`, name: "T" });
    homeId = (await sp.getState(user)).pages[0].id;
    const groupId = (await sp.getState(user)).pages[0].groups[0].id;
    await sp.createItem(user, { groupId, type: "link", url: "https://linear.app", title: "Linear issue tracker" });
    secretId = (await sp.createPage(user, { name: "Private" })).id;
    await sp.updatePage(user, secretId, { hiddenFromAgents: true });
    const secretGroup = (await sp.getState(user)).pages.find((p) => p.id === secretId)!.groups[0].id;
    await sp.createItem(user, { groupId: secretGroup, type: "link", url: "https://bank.example.com", title: "Linear bank login" });
    workId = (await sp.createPage(user, { name: "Work" })).id;
  });

  afterAll(async () => {
    await dbMod.pool.query("DELETE FROM users WHERE id = ?", [user]);
    if (client) await dbMod.pool.query("DELETE FROM oauth_clients WHERE id = ?", [client.client_id]);
    await dbMod.pool.end();
  });

  async function call(method: string, params: unknown, token = access) {
    const res = await mcp.POST(
      new Request("http://localhost:3000/mcp", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "MCP-Protocol-Version": "2025-06-18",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      }),
    );
    return { status: res.status, headers: res.headers, body: res.status === 200 ? await res.json() : await res.text() };
  }
  const tool = async (name: string, args: Record<string, unknown> = {}) => {
    const r = await call("tools/call", { name, arguments: args });
    const result = r.body.result as { content: { text: string }[]; isError?: boolean };
    const text = result.content[0].text;
    const json = text.includes("{") ? JSON.parse(text.slice(text.indexOf("{"))) : null;
    return { text, json, isError: Boolean(result.isError) };
  };

  it("registers clients and only accepts safe redirect addresses", async () => {
    await expect(oauth.registerClient({ redirect_uris: ["http://evil.example.com/cb"] })).rejects.toThrow(/https/);
    await expect(oauth.registerClient({ redirect_uris: ["javascript:alert(1)"] })).rejects.toThrow();
    client = await oauth.registerClient({ client_name: "Claude", redirect_uris: ["https://claude.ai/api/mcp/auth_callback", "http://localhost/cb"] });
    expect(client).toMatchObject({ client_name: "Claude", token_endpoint_auth_method: "none" });
    expect(client).not.toHaveProperty("client_secret");
    expect(oauth.redirectUriMatches(client.redirect_uris as string[], "http://localhost:53682/cb")).toBe(true); // any loopback port
    expect(oauth.redirectUriMatches(client.redirect_uris as string[], "https://claude.ai/other")).toBe(false);
  });

  it("runs the authorization code flow with PKCE and issues hashed tokens", async () => {
    const params = new URLSearchParams({
      client_id: client.client_id,
      redirect_uri: "https://claude.ai/api/mcp/auth_callback",
      response_type: "code",
      code_challenge: challenge,
      code_challenge_method: "S256",
      state: "xyz",
      resource: oauth.MCP_RESOURCE,
    });
    const noPkce = new URLSearchParams(params);
    noPkce.delete("code_challenge");
    const bad = await oauth.validateAuthorizeRequest(noPkce);
    expect(bad.ok === false && bad.redirect).toContain("error=invalid_request");

    const check = await oauth.validateAuthorizeRequest(params);
    if (!check.ok) throw new Error("expected a valid request");
    const redirect = new URL(await oauth.approveAuthorization(user, check.request, "read"));
    expect(redirect.origin + redirect.pathname).toBe("https://claude.ai/api/mcp/auth_callback");
    expect(redirect.searchParams.get("state")).toBe("xyz");
    const code = redirect.searchParams.get("code")!;

    const form = (extra: Record<string, string>) => new URLSearchParams({ client_id: client.client_id, ...extra });
    await expect(oauth.exchangeCode({ id: client.client_id }, form({ code, code_verifier: "x".repeat(43) }))).rejects.toThrow(/PKCE/);
    // The failed attempt used the code up; a fresh authorization is needed.
    const code2 = new URL(await oauth.approveAuthorization(user, check.request, "read")).searchParams.get("code")!;
    const tokens = await oauth.exchangeCode({ id: client.client_id }, form({ code: code2, code_verifier: verifier }));
    expect(tokens).toMatchObject({ token_type: "Bearer", expires_in: 3600, scope: "syncpads" });
    access = tokens.access_token;
    refresh = tokens.refresh_token;

    // Codes are single use; tokens are stored only as hashes.
    await expect(oauth.exchangeCode({ id: client.client_id }, form({ code: code2, code_verifier: verifier }))).rejects.toThrow(/already used/);
    const [rows] = await dbMod.pool.query("SELECT token_hash FROM oauth_tokens WHERE user_id = ?", [user]);
    expect(JSON.stringify(rows)).not.toContain(access);

    // A replayed code revoked that connection's tokens, so authorize once more.
    const code3 = new URL(await oauth.approveAuthorization(user, check.request, "read")).searchParams.get("code")!;
    const fresh = await oauth.exchangeCode({ id: client.client_id }, form({ code: code3, code_verifier: verifier }));
    access = fresh.access_token;
    refresh = fresh.refresh_token;
    const ctx = await oauth.verifyAccessToken(access);
    expect(ctx).toMatchObject({ userId: user, permission: "read", agentName: "Claude" });
    agentId = ctx!.agentId;
    // One agent per user + client, however many times they authorize.
    expect((await agentsMod.listAgents(user)).map((a) => a.client)).toEqual(["claude"]);
  });

  it("rotates refresh tokens and treats reuse of an old one as theft", async () => {
    const form = new URLSearchParams({ client_id: client.client_id, refresh_token: refresh });
    const next = await oauth.refreshTokens({ id: client.client_id }, form);
    expect(await oauth.verifyAccessToken(next.access_token)).not.toBeNull();
    await expect(oauth.refreshTokens({ id: client.client_id }, form)).rejects.toThrow(/already used/);
    expect(await oauth.verifyAccessToken(next.access_token)).toBeNull(); // everything revoked

    const check = await oauth.validateAuthorizeRequest(
      new URLSearchParams({
        client_id: client.client_id,
        redirect_uri: "https://claude.ai/api/mcp/auth_callback",
        response_type: "code",
        code_challenge: challenge,
        code_challenge_method: "S256",
      }),
    );
    if (!check.ok) throw new Error("expected a valid request");
    const code = new URL(await oauth.approveAuthorization(user, check.request, "read")).searchParams.get("code")!;
    access = (await oauth.exchangeCode({ id: client.client_id }, new URLSearchParams({ code, code_verifier: verifier }))).access_token;
  });

  it("rejects MCP calls without a valid token, pointing to the OAuth metadata", async () => {
    const res = await call("tools/list", {}, "not-a-token");
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain('resource_metadata="');
    expect(res.headers.get("www-authenticate")).toContain("/.well-known/oauth-protected-resource/mcp");
  });

  it("serves the four tools and never shows hidden pages", async () => {
    const init = await call("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } });
    expect(init.body.result.serverInfo.name).toBe("syncpads");
    const list = await call("tools/list", {});
    expect(list.body.result.tools.map((t: { name: string }) => t.name).sort()).toEqual(["add_link", "get_page", "list_pages", "search"]);

    const pages = await tool("list_pages");
    expect(pages.json.pages.map((p: { name: string }) => p.name)).toEqual(["Home", "Work"]); // not "Private"

    const found = await tool("search", { query: "linear" });
    expect(found.text.startsWith(agentsMod.UNTRUSTED_NOTE)).toBe(true);
    expect(found.json.results.map((r: { title: string }) => r.title)).toEqual(["Linear issue tracker"]); // not the hidden bank login

    const page = await tool("get_page", { page_id: homeId, format: "markdown" });
    expect(page.text).toContain("# Home");
    expect(page.text).toContain("[Linear issue tracker](https://linear.app/)");
    const hidden = await tool("get_page", { page_id: secretId });
    expect(hidden).toMatchObject({ isError: true });
    expect(hidden.text).toMatch(/isn't available/);
  });

  it("enforces read-only access, then sends added links to the inbox", async () => {
    const denied = await tool("add_link", { url: "https://figma.com" });
    expect(denied.isError).toBe(true);
    expect(denied.text).toMatch(/read-only/);

    await agentsMod.updateAgent(user, agentId, { permission: "read_add" });
    // Permission changes apply to the next call (no new token needed).
    const added = await tool("add_link", { url: "figma.com", title: "Figma", page_id: workId, reason: "You asked for design tools" });
    expect(added.json).toMatchObject({ status: "added_to_inbox", page: "Work" });
    expect((await tool("add_link", { url: "https://figma.com/" })).json.status).toBe("already_in_inbox");

    const state = await sp.getState(user);
    expect(state.inbox).toHaveLength(1);
    expect(state.inbox[0]).toMatchObject({ title: "Figma", agentName: "Claude", reason: "You asked for design tools", pageId: workId });
    expect(state.pages.find((p) => p.id === workId)!.groups[0].items).toHaveLength(0); // not on the page yet

    await sp.approveInboxItem(user, state.inbox[0].id, {});
    const after = await sp.getState(user);
    expect(after.inbox).toHaveLength(0);
    expect(after.pages.find((p) => p.id === workId)!.groups[0].items.map((i) => i.title)).toEqual(["Figma"]);
  });

  it("skips the inbox with auto-approve, logs everything, and undoes", async () => {
    await agentsMod.updateAgent(user, agentId, { autoApprove: true });
    const added = await tool("add_link", { url: "https://vercel.com", title: "Vercel" });
    expect(added.json.status).toBe("added");
    const home = (await sp.getState(user)).pages.find((p) => p.id === homeId)!;
    expect(home.groups[0].items.map((i) => i.title)).toContain("Vercel");

    const log = await agentsMod.listActivity(user);
    expect(log.map((e) => e.action)).toEqual(
      expect.arrayContaining(["list_pages", "search", "get_page", "add_link"]),
    );
    const entry = log.find((e) => e.action === "add_link" && e.itemTitle === "Vercel")!;
    expect(entry.canUndo).toBe(true);
    expect(await agentsMod.undoActivity(user, entry.id)).toBe(true);
    expect(await agentsMod.undoActivity(user, entry.id)).toBe(false); // once only
    const homeAfter = (await sp.getState(user)).pages.find((p) => p.id === homeId)!;
    expect(homeAfter.groups[0].items.map((i) => i.title)).not.toContain("Vercel");
  });

  it("limits an agent to chosen pages", async () => {
    await agentsMod.updateAgent(user, agentId, { pageIds: [workId] });
    expect((await tool("list_pages")).json.pages.map((p: { name: string }) => p.name)).toEqual(["Work"]);
    expect((await tool("search", { query: "linear" })).json.results).toEqual([]); // Linear is on Home
    await agentsMod.updateAgent(user, agentId, { pageIds: null });
    expect((await tool("list_pages")).json.pages).toHaveLength(2);
  });

  it("rate limits at 60 calls a minute", async () => {
    const minuteKey = [...counters.keys()].find((k) => k.startsWith(`agent:${agentId}:m:`))!;
    counters.set(minuteKey, 60);
    const limited = await tool("list_pages");
    expect(limited).toMatchObject({ isError: true });
    expect(limited.text).toMatch(/60 SyncPads calls a minute/);
    counters.set(minuteKey, 0);
  });

  it("cuts off a revoked agent immediately and keeps its log", async () => {
    expect(await agentsMod.revokeAgent(user, agentId)).toBe(true);
    expect((await call("tools/list", {})).status).toBe(401);
    expect(await agentsMod.listAgents(user)).toEqual([]);
    expect((await agentsMod.listActivity(user)).length).toBeGreaterThan(0);
  });
});
