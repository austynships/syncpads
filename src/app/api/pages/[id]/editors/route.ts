import { body, handle, schemas } from "@/server/api";
import { listEditors, removeEditor } from "@/server/share";

// People who joined the owner's page through its edit link (owner only).
export async function GET(request: Request, ctx: RouteContext<"/api/pages/[id]/editors">) {
  const { id } = await ctx.params;
  return handle(request, async ({ userId }) => ({ editors: await listEditors(userId, id) }));
}

// The owner removes one editor: the page disappears from their workspace.
export async function DELETE(request: Request, ctx: RouteContext<"/api/pages/[id]/editors">) {
  const { id } = await ctx.params;
  return handle(request, async ({ userId }) => removeEditor(userId, id, (await body(request, schemas.removeEditor)).userId));
}
