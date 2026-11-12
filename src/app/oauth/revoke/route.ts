import { authenticateClient, revokeToken } from "@/server/oauth";
import { oauthEndpoint, preflight, readForm } from "@/server/oauth-http";
import { CORS } from "@/server/oauth-http";

// RFC 7009 token revocation.
export function POST(request: Request) {
  return oauthEndpoint(async () => {
    const form = await readForm(request);
    const client = await authenticateClient(form, request.headers.get("authorization"));
    await revokeToken(client, form.get("token") ?? "");
    return new Response(null, { status: 200, headers: CORS });
  });
}
export const OPTIONS = preflight;
