import { handle } from "@/server/api";
import { copySharedPage } from "@/server/share";

// Save a copy of a shared page into the signed-in user's SyncPads, as a new page.
export async function POST(request: Request, ctx: RouteContext<"/api/shared/[token]/copy">) {
  const { token } = await ctx.params;
  return handle(request, ({ userId }) => copySharedPage(userId, token));
}
