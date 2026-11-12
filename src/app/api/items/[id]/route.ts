import { body, handle, schemas } from "@/server/api";
import { deleteItem, updateItem } from "@/server/start-page";

export async function PATCH(request: Request, ctx: RouteContext<"/api/items/[id]">) {
  const { id } = await ctx.params;
  return handle(request, async ({ userId }) => updateItem(userId, id, await body(request, schemas.updateItem)));
}

// Moves the item to the trash; POST /api/items/[id]/restore undoes it.
export async function DELETE(request: Request, ctx: RouteContext<"/api/items/[id]">) {
  const { id } = await ctx.params;
  return handle(request, ({ userId }) => deleteItem(userId, id));
}

