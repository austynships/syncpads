import { body, handle, schemas } from "@/server/api";
import { reportGalleryWidget } from "@/server/custom-widgets";

// Report a gallery widget; enough reports send it back to review.
export async function POST(request: Request, ctx: RouteContext<"/api/gallery/[id]/report">) {
  const { id } = await ctx.params;
  return handle(request, async ({ userId }) => reportGalleryWidget(userId, id, (await body(request, schemas.reportGallery)).reason ?? ""));
}
