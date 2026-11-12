import { protectedResourceMetadata } from "@/server/oauth";
import { json, preflight } from "@/server/oauth-http";
import { logAgentRequest } from "@/server/request-log";

// RFC 9728 protected resource metadata for the MCP server.
export function GET(request: Request) {
  logAgentRequest("discovery", request, 200);
  return json(protectedResourceMetadata(), 200, { "Cache-Control": "public, max-age=3600" });
}
export const OPTIONS = preflight;
