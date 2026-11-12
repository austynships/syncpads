import { body, handle, schemas } from "@/server/api";
import { updateSettings } from "@/server/start-page";

export function PATCH(request: Request) {
  return handle(request, async ({ userId }) => updateSettings(userId, await body(request, schemas.settings)));
}

