import { body, handle, schemas } from "@/server/api";
import { createItem } from "@/server/start-page";

export function POST(request: Request) {
  return handle(request, async ({ userId }) => createItem(userId, await body(request, schemas.createItem)));
}

