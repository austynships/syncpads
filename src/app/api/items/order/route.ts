import { body, handle, schemas } from "@/server/api";
import { reorderItems } from "@/server/start-page";

export function PUT(request: Request) {
  return handle(request, async ({ userId }) => {
    const { groupId, ids } = await body(request, schemas.reorderItems);
    return reorderItems(userId, groupId, ids);
  });
}

