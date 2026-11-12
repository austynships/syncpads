import { handle } from "@/server/api";
import { getRevision } from "@/server/start-page";

// Cheap check that clients poll every few seconds (SP-6).
export function GET(request: Request) {
  return handle(request, async ({ userId }) => ({ revision: await getRevision(userId) }));
}

