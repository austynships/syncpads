import { handle } from "@/server/api";
import { unreadCount } from "@/server/notifications";

// Just the unread count, for the bell (polled).
export function GET(request: Request) {
  return handle(request, async ({ userId }) => ({ unread: await unreadCount(userId) }));
}
