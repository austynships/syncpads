import { auth } from "@/lib/auth";
import { exportFileName, toBookmarksHtml } from "@/lib/syncpads-file";
import { NotFoundError, exportPages } from "@/server/start-page";

/**
 * Downloads the user's pages (SP-10).
 *   ?format=json  (default) SyncPads file: pages, groups, links and notes; imports back losslessly.
 *   ?format=html  Browser bookmarks: pages as folders, groups as subfolders; no notes.
 *   &pageId=...   Just that page.
 */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Please sign in." }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const format = params.get("format") === "html" ? "html" : "json";
  const pageId = params.get("pageId")?.slice(0, 36) || undefined;

  try {
    const file = await exportPages(session.user.id, pageId);
    const name = exportFileName(format, pageId ? file.pages[0]?.name : undefined);
    const content = format === "html" ? toBookmarksHtml(file.pages) : JSON.stringify(file, null, 2);
    return new Response(content, {
      headers: {
        "Content-Type": format === "html" ? "text/html; charset=utf-8" : "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    if (err instanceof NotFoundError) return Response.json({ error: "Page not found." }, { status: 404 });
    console.error("[export]", err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
