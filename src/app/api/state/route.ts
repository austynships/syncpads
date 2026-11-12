import { handle } from "@/server/api";
import { getState } from "@/server/start-page";

// Full start page state for the signed-in user.
export function GET(request: Request) {
  return handle(request, ({ userId }) => getState(userId));
}

