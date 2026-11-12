import { auth } from "@/lib/auth";
import { getFavicon, isValidHost } from "@/server/favicon";

// GET /api/favicon?host=example.com — signed-in users only, so this can't be
// used as an open proxy.
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });

  const host = new URL(request.url).searchParams.get("host")?.toLowerCase() ?? "";
  if (!isValidHost(host)) return new Response(null, { status: 400 });

  const icon = await getFavicon(host).catch(() => null);
  if (!icon) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "private, max-age=86400" } });
  }
  return new Response(new Uint8Array(icon.data), {
    headers: {
      "Content-Type": icon.contentType,
      "Cache-Control": "private, max-age=604800",
      "X-Content-Type-Options": "nosniff",
      // SVG icons can contain scripts; this stops them from running if opened directly.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}

