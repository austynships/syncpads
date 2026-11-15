import { body, handle, schemas } from "@/server/api";
import { importBookmarks, importSyncPadsFile } from "@/server/start-page";

// Imports as new pages: a bookmark tree (SP-9, from the web importer and the
// extension) or a SyncPads export file (SP-10).
export function POST(request: Request) {
  return handle(request, async ({ userId }) => {
    const input = await body(request, schemas.import);
    return "file" in input ? importSyncPadsFile(userId, input.file) : importBookmarks(userId, input.tree);
  });
}
