import { handle } from "@/server/api";
import { listActivity } from "@/server/agents";

// The agent activity log (SP-17), newest first.
export function GET(request: Request) {
  return handle(request, async ({ userId }) => ({ entries: await listActivity(userId, 200) }));
}
