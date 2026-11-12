import { body, handle, schemas } from "@/server/api";
import { revokeAgent, updateAgent } from "@/server/agents";
import { NotFoundError } from "@/server/start-page";

// Change an agent's name, permission, auto-approve or page access (SP-18).
export async function PATCH(request: Request, ctx: RouteContext<"/api/agents/[id]">) {
  const { id } = await ctx.params;
  return handle(request, async ({ userId }) => {
    if (!(await updateAgent(userId, id, await body(request, schemas.updateAgent)))) throw new NotFoundError("Agent");
    return { ok: true };
  });
}

// Disconnect an agent: its access stops immediately; its activity stays in the log.
export async function DELETE(request: Request, ctx: RouteContext<"/api/agents/[id]">) {
  const { id } = await ctx.params;
  return handle(request, async ({ userId }) => {
    if (!(await revokeAgent(userId, id))) throw new NotFoundError("Agent");
    return { ok: true };
  });
}
