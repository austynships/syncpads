/** HTTP helpers for the OAuth endpoints: JSON with CORS (tokens aren't cookies, so any origin may call) and no caching. */
import { OAuthError } from "./oauth";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, MCP-Protocol-Version",
};

export function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { ...CORS, "Cache-Control": "no-store", Pragma: "no-cache", ...extra } });
}

export function preflight() {
  return new Response(null, { status: 204, headers: { ...CORS, "Access-Control-Max-Age": "86400" } });
}

/** Runs an OAuth endpoint and turns errors into RFC 6749 error responses. */
export async function oauthEndpoint(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof OAuthError) {
      const extra: Record<string, string> = err.status === 401 ? { "WWW-Authenticate": 'Basic realm="SyncPads"' } : {};
      return json(err.toJSON(), err.status, extra);
    }
    console.error("[oauth]", err);
    return json({ error: "server_error", error_description: "Something went wrong." }, 500);
  }
}

/** Reads an application/x-www-form-urlencoded body (the token and revocation endpoints). */
export async function readForm(request: Request): Promise<URLSearchParams> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return new URLSearchParams(Object.entries(body).map(([k, v]) => [k, String(v)]));
  }
  return new URLSearchParams(await request.text());
}
