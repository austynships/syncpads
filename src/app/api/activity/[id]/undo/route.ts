import { handle } from "@/server/api";
import { undoActivity } from "@/server/agents";
import { InvalidInputError } from "@/server/start-page";

// Undo one agent action (SP-17): an added link goes to the trash. Allowed for 30 days.
export async function POST(request: Request, ctx: RouteContext<"/api/activity/[id]/undo">) {
  const { id } = await ctx.params;
  return handle(request, async ({ userId }) => {
    if (!(await undoActivity(userId, id))) throw new InvalidInputError("This action can no longer be undone.");
    return { ok: true };
  });
}
