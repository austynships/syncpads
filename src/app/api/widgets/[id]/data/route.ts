import { handle } from "@/server/api";
import { widgetData } from "@/server/widgets";

// Live data for weather and news feed widgets (cached on the server).
export async function GET(request: Request, ctx: RouteContext<"/api/widgets/[id]/data">) {
  const { id } = await ctx.params;
  return handle(request, ({ userId }) => widgetData(userId, id));
}
