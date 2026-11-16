import { NotFoundError } from "@/server/start-page";
import { sharedWidgetData } from "@/server/share";

// Weather and news feed data for widgets on a shared page. Visitors may not be
// signed in; only widgets on that shared page are served, and data is cached.
export async function GET(_request: Request, ctx: RouteContext<"/api/shared/[token]/widgets/[id]">) {
  const { token, id } = await ctx.params;
  try {
    return Response.json(await sharedWidgetData(token, id), { headers: { "Cache-Control": "public, max-age=300" } });
  } catch (err) {
    if (err instanceof NotFoundError) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ error: (err as Error).message || "Not available right now." }, { status: 503 });
  }
}
