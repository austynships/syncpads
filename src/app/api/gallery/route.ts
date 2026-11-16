import { handle } from "@/server/api";
import { listGallery } from "@/server/custom-widgets";

// Published gallery widgets (signed-in users), optionally searched with ?q=.
export function GET(request: Request) {
  return handle(request, async () => ({ widgets: await listGallery(new URL(request.url).searchParams.get("q") ?? undefined) }));
}
