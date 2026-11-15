import { handle } from "@/server/api";
import { joinSharedPage } from "@/server/share";

// Join a page through its edit link: it becomes a tab in the user's workspace.
export async function POST(request: Request, ctx: RouteContext<"/api/shared/[token]/join">) {
  const { token } = await ctx.params;
  return handle(request, ({ userId }) => joinSharedPage(userId, token));
}
