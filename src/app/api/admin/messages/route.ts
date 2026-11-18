import { auth } from "@/lib/auth";
import { schemas } from "@/server/api";
import { isAdmin } from "@/server/admin";
import { parseEmails, sendDirectMessage } from "@/server/notifications";

// Admins send a notification to specific people, by email.
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || !isAdmin(session.user)) return new Response(null, { status: 404 });
  const origin = request.headers.get("origin");
  if (origin && new URL(process.env.BETTER_AUTH_URL ?? request.url).origin !== origin) {
    return Response.json({ error: "Cross-site request blocked." }, { status: 403 });
  }
  const parsed = schemas.directMessage.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  const emails = parseEmails(parsed.data.to);
  if (emails.length === 0) return Response.json({ error: "Add at least one email address." }, { status: 400 });
  return Response.json(await sendDirectMessage(session.user.id, { ...parsed.data, emails }));
}
