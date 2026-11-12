import { handle } from "@/server/api";
import { dismissInboxItem } from "@/server/start-page";

// Dismiss a link from the Agent Inbox (SP-16).
export async function POST(request: Request, ctx: RouteContext<"/api/inbox/[id]/dismiss">) {
  const { id } = await ctx.params;
  return handle(request, ({ userId }) => dismissInboxItem(userId, id));
}
