import { body, handle, schemas } from "@/server/api";
import { importBookmarks } from "@/server/start-page";

// Imports a bookmark tree as new pages (SP-9). Used by the web importer and the extension.
export function POST(request: Request) {
  return handle(request, async ({ userId }) => importBookmarks(userId, (await body(request, schemas.import)).tree));
}
