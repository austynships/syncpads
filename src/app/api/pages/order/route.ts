import { body, handle, schemas } from "@/server/api";
import { reorderPages } from "@/server/start-page";

export function PUT(request: Request) {
  return handle(request, async ({ userId }) => {
    const { ids } = await body(request, schemas.reorderPages);
    return reorderPages(userId, ids);
  });
}

