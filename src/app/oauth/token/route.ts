import { authenticateClient, exchangeCode, OAuthError, refreshTokens } from "@/server/oauth";
import { json, oauthEndpoint, preflight, readForm } from "@/server/oauth-http";

// Token endpoint: authorization_code (with PKCE) and refresh_token grants.
export function POST(request: Request) {
  return oauthEndpoint(request, async () => {
    const form = await readForm(request);
    const client = await authenticateClient(form, request.headers.get("authorization"));
    switch (form.get("grant_type")) {
      case "authorization_code":
        return json(await exchangeCode(client, form));
      case "refresh_token":
        return json(await refreshTokens(client, form));
      default:
        throw new OAuthError("unsupported_grant_type", "Use authorization_code or refresh_token.");
    }
  });
}
export const OPTIONS = preflight;
