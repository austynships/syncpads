import { body, handle, schemas } from "@/server/api";
import { sharePage, unsharePage } from "@/server/share";

// Turn on sharing (or change whether notes are included). Keeps the current link.
export async function POST(request: Request, ctx: RouteContext<"/api/pages/[id]/share">) {
  const { id } = await ctx.params;
  return handle(request, async ({ userId }) => sharePage(userId, id, await body(request, schemas.sharePage)));
}

// Turn off sharing: the link stops working immediately.
export async function DELETE(request: Request, ctx: RouteContext<"/api/pages/[id]/share">) {
  const { id } = await ctx.params;
  return handle(request, ({ userId }) => unsharePage(userId, id));
}
