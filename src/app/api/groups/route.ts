import { body, handle, schemas } from "@/server/api";
import { createGroup } from "@/server/start-page";

export function POST(request: Request) {
  return handle(request, async ({ userId }) => createGroup(userId, await body(request, schemas.createGroup)));
}

