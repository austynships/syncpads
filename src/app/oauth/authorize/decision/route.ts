import { auth } from "@/lib/auth";
import { approveAuthorization, ORIGIN, validateAuthorizeRequest, withParams } from "@/server/oauth";
import { logAgentRequest } from "@/server/request-log";

// The consent form posts here. Only our own consent page may post (Origin
// check), and only for a signed-in user.
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== ORIGIN && origin !== new URL(request.url).origin) {
    return new Response("Cross-site request blocked.", { status: 403 });
  }
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response("Please sign in.", { status: 401 });

  const form = new URLSearchParams(await request.text());
  const decision = form.get("decision");
  const permission = form.get("permission") === "read" ? "read" : "read_add";
  form.delete("decision");
  form.delete("permission");

  const check = await validateAuthorizeRequest(form);
  if (!check.ok) {
    if (check.redirect) return redirectTo(check.redirect);
    return new Response(check.show ?? "Invalid request.", { status: 400 });
  }

  logAgentRequest("consent", request, 303, { client: check.request.client.name, decision, permission });
  if (decision !== "allow") {
    const url = withParams(check.request.redirectUri, {
      error: "access_denied",
      error_description: "The user denied the request.",
      state: check.request.state,
      iss: ORIGIN,
    });
    return redirectTo(url);
  }
  return redirectTo(await approveAuthorization(session.user.id, check.request, permission));
}

// Response.redirect() rejects some app schemes (cursor://), so set Location directly.
function redirectTo(url: string) {
  return new Response(null, { status: 303, headers: { Location: url, "Cache-Control": "no-store" } });
}
