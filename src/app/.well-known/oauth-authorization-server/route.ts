import { authorizationServerMetadata } from "@/server/oauth";
import { json, preflight } from "@/server/oauth-http";

// RFC 8414 authorization server metadata (how agents find the OAuth endpoints).
export const GET = () => json(authorizationServerMetadata(), 200, { "Cache-Control": "public, max-age=3600" });
export const OPTIONS = preflight;
