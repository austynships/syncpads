import { body, handle, schemas } from "@/server/api";
import { markRead } from "@/server/notifications";

// Mark some notifications as read ({ ids }) or all of them ({ all: true }).
export function POST(request: Request) {
  return handle(request, async ({ userId }) => {
    const input = await body(request, schemas.markRead);
    return markRead(userId, input.all ? "all" : (input.ids ?? []));
  });
}
