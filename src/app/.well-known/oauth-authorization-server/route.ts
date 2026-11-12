import { authorizationServerMetadata } from "@/server/oauth";
import { json, preflight } from "@/server/oauth-http";
import { logAgentRequest } from "@/server/request-log";

// RFC 8414 authorization server metadata (how agents find the OAuth endpoints).
export function GET(request: Request) {
  logAgentRequest("discovery", request, 200);
  return json(authorizationServerMetadata(), 200, { "Cache-Control": "public, max-age=3600" });
}
export const OPTIONS = preflight;
