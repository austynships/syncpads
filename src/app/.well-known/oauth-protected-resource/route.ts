import { protectedResourceMetadata } from "@/server/oauth";
import { json, preflight } from "@/server/oauth-http";

// RFC 9728 protected resource metadata for the MCP server.
export const GET = () => json(protectedResourceMetadata(), 200, { "Cache-Control": "public, max-age=3600" });
export const OPTIONS = preflight;
