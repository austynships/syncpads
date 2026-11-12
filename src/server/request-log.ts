/**
 * One log line per request to the agent endpoints (/mcp, /oauth/*, /.well-known/*),
 * so connection problems can be diagnosed from `docker compose logs app`.
 * Never logs tokens, codes, secrets or request bodies; only what's listed here.
 */
export function logAgentRequest(
  tag: string,
  request: Request,
  status: number,
  extra: Record<string, string | number | boolean | null | undefined> = {},
) {
  const url = new URL(request.url);
  const line = {
    at: new Date().toISOString(),
    tag,
    method: request.method,
    path: url.pathname,
    status,
    ua: (request.headers.get("user-agent") ?? "").slice(0, 120),
    ...extra,
  };
  console.log(`[agents] ${JSON.stringify(line)}`);
}
