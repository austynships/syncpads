import { body, handle, schemas } from "@/server/api";
import { createWidget } from "@/server/widgets";

// Add a widget to a page (owners and editors of a shared page).
export function POST(request: Request) {
  return handle(request, async ({ userId }) => createWidget(userId, await body(request, schemas.createWidget)));
}
