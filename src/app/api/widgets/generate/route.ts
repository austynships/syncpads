import { body, handle, schemas } from "@/server/api";
import { buildWidget } from "@/server/custom-widgets";

// Build (or change) a custom widget with AI, for preview. Pro only; nothing is saved here.
export function POST(request: Request) {
  return handle(request, async ({ userId }) => ({ widget: await buildWidget(userId, await body(request, schemas.buildWidget)) }));
}
