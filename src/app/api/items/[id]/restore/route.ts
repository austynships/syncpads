import { handle } from "@/server/api";
import { restoreItem } from "@/server/start-page";

export async function POST(request: Request, ctx: RouteContext<"/api/items/[id]/restore">) {
  const { id } = await ctx.params;
  return handle(request, ({ userId }) => restoreItem(userId, id));
}

