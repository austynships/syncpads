import { body, handle, schemas } from "@/server/api";
import { deletePage, updatePage } from "@/server/start-page";

export async function PATCH(request: Request, ctx: RouteContext<"/api/pages/[id]">) {
  const { id } = await ctx.params;
  return handle(request, async ({ userId }) => updatePage(userId, id, await body(request, schemas.updatePage)));
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/pages/[id]">) {
  const { id } = await ctx.params;
  return handle(request, ({ userId }) => deletePage(userId, id));
}

