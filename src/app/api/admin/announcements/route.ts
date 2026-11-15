import { auth } from "@/lib/auth";
import { body, schemas } from "@/server/api";
import { isAdmin } from "@/server/admin";
import { createAnnouncement } from "@/server/notifications";

// Admins send an announcement (such as a new feature) to everyone, or only Free or Pro users.
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || !isAdmin(session.user)) return new Response(null, { status: 404 });
  if (request.headers.get("origin") && new URL(process.env.BETTER_AUTH_URL ?? request.url).origin !== request.headers.get("origin")) {
    return Response.json({ error: "Cross-site request blocked." }, { status: 403 });
  }
  try {
    const input = await body(request, schemas.announcement);
    return Response.json(await createAnnouncement(session.user.id, input));
  } catch (err) {
    const message = (err as { issues?: { message: string }[] }).issues?.[0]?.message ?? "Invalid input.";
    return Response.json({ error: message }, { status: 400 });
  }
}
