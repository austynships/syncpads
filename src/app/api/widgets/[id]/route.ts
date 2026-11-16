import { body, handle, schemas } from "@/server/api";
import { deleteWidget, updateWidget } from "@/server/widgets";

export async function PATCH(request: Request, ctx: RouteContext<"/api/widgets/[id]">) {
  const { id } = await ctx.params;
  return handle(request, async ({ userId }) => updateWidget(userId, id, await body(request, schemas.updateWidget)));
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/widgets/[id]">) {
  const { id } = await ctx.params;
  return handle(request, ({ userId }) => deleteWidget(userId, id));
}
