import { handle } from "@/server/api";
import { leaveSharedPage } from "@/server/share";

// An editor leaves a page someone shared with them.
export async function POST(request: Request, ctx: RouteContext<"/api/pages/[id]/leave">) {
  const { id } = await ctx.params;
  return handle(request, ({ userId }) => leaveSharedPage(userId, id));
}
