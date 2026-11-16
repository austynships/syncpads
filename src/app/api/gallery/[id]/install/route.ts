import { body, handle, schemas } from "@/server/api";
import { installGalleryWidget } from "@/server/custom-widgets";

// Add a copy of a gallery widget to one of the user's pages.
export async function POST(request: Request, ctx: RouteContext<"/api/gallery/[id]/install">) {
  const { id } = await ctx.params;
  return handle(request, async ({ userId }) => installGalleryWidget(userId, id, (await body(request, schemas.installGallery)).pageId));
}
