import { auth } from "@/lib/auth";
import { schemas } from "@/server/api";
import { isAdmin } from "@/server/admin";
import { reviewGalleryWidget } from "@/server/custom-widgets";

// Admins approve, reject or remove a gallery widget.
export async function POST(request: Request, ctx: RouteContext<"/api/admin/gallery/[id]">) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || !isAdmin(session.user)) return new Response(null, { status: 404 });
  const origin = request.headers.get("origin");
  if (origin && new URL(process.env.BETTER_AUTH_URL ?? request.url).origin !== origin) {
    return Response.json({ error: "Cross-site request blocked." }, { status: 403 });
  }
  const parsed = schemas.reviewGallery.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid input." }, { status: 400 });
  const { id } = await ctx.params;
  return Response.json(await reviewGalleryWidget(session.user.id, id.slice(0, 36), parsed.data.decision, parsed.data.note ?? undefined));
}
