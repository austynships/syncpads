import { handle } from "@/server/api";
import { listNotifications } from "@/server/notifications";

// The signed-in user's notifications, newest first, with the unread count.
export function GET(request: Request) {
  return handle(request, ({ userId }) => listNotifications(userId));
}
