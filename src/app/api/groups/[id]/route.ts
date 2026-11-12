import { body, handle, schemas } from "@/server/api";
import { deleteGroup, updateGroup } from "@/server/start-page";

export async function PATCH(request: Request, ctx: RouteContext<"/api/groups/[id]">) {
  const { id } = await ctx.params;
  return handle(request, async ({ userId }) => updateGroup(userId, id, await body(request, schemas.updateGroup)));
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/groups/[id]">) {
  const { id } = await ctx.params;
  return handle(request, ({ userId }) => deleteGroup(userId, id));
}

