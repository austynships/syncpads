import { getFavicon, isValidHost } from "@/server/favicon";
import { sharedPageHasHost } from "@/server/share";

// Favicons for a shared page's visitors, who may not be signed in. Only hosts
// that are linked on that shared page are served, so this isn't an open proxy.
export async function GET(request: Request, ctx: RouteContext<"/api/shared/[token]/favicon">) {
  const { token } = await ctx.params;
  const host = new URL(request.url).searchParams.get("host")?.toLowerCase() ?? "";
  if (!isValidHost(host) || !(await sharedPageHasHost(token, host))) return new Response(null, { status: 404 });

  const icon = await getFavicon(host).catch(() => null);
  if (!icon) return new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=86400" } });
  return new Response(new Uint8Array(icon.data), {
    headers: {
      "Content-Type": icon.contentType,
      "Cache-Control": "public, max-age=604800",
      "X-Content-Type-Options": "nosniff",
      // SVG icons can contain scripts; this stops them from running if opened directly.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
