import { body, handle, schemas } from "@/server/api";
import { reorderWidgets } from "@/server/widgets";

export async function PUT(request: Request) {
  return handle(request, async ({ userId }) => {
    const { pageId, ids } = await body(request, schemas.reorderWidgets);
    return reorderWidgets(userId, pageId, ids);
  });
}
