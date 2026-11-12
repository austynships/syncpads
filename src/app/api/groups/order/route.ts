import { body, handle, schemas } from "@/server/api";
import { reorderGroups } from "@/server/start-page";

export function PUT(request: Request) {
  return handle(request, async ({ userId }) => {
    const { pageId, ids } = await body(request, schemas.reorderGroups);
    return reorderGroups(userId, pageId, ids);
  });
}

