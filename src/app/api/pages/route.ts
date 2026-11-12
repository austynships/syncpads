import { body, handle, schemas } from "@/server/api";
import { createPage } from "@/server/start-page";

export function POST(request: Request) {
  return handle(request, async ({ userId }) => createPage(userId, await body(request, schemas.createPage)));
}

