import { body, handle, schemas } from "@/server/api";
import { publishWidget } from "@/server/custom-widgets";

// Send a custom widget to the gallery (it's reviewed before it's listed).
export async function POST(request: Request, ctx: RouteContext<"/api/widgets/[id]/publish">) {
  const { id } = await ctx.params;
  return handle(request, async ({ userId }) => publishWidget(userId, id, await body(request, schemas.publishWidget)));
}
