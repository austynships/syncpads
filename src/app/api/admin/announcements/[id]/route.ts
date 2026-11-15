import { auth } from "@/lib/auth";
import { isAdmin } from "@/server/admin";
import { deleteAnnouncement } from "@/server/notifications";

// Retract an announcement: it disappears from everyone's notifications.
export async function DELETE(request: Request, ctx: RouteContext<"/api/admin/announcements/[id]">) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || !isAdmin(session.user)) return new Response(null, { status: 404 });
  if (request.headers.get("origin") && new URL(process.env.BETTER_AUTH_URL ?? request.url).origin !== request.headers.get("origin")) {
    return Response.json({ error: "Cross-site request blocked." }, { status: 403 });
  }
  const { id } = await ctx.params;
  return Response.json(await deleteAnnouncement(id.slice(0, 36)));
}
