import { body, handle, schemas } from "@/server/api";
import { approveInboxItem } from "@/server/start-page";

// Approve a link from the Agent Inbox (SP-16), optionally into another group or with a new title.
export async function POST(request: Request, ctx: RouteContext<"/api/inbox/[id]/approve">) {
  const { id } = await ctx.params;
  return handle(request, async ({ userId }) => approveInboxItem(userId, id, await body(request, schemas.approveInbox)));
}
