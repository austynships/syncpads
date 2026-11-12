/**
 * Favicons for links, fetched by our server and cached in the `favicons` table,
 * so no third party learns which sites a user saves.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { favicons } from "@/db/schema";
import { safeFetch } from "./safe-fetch";

const OK_TTL_MS = 7 * 24 * 60 * 60 * 1000; // refresh icons weekly
const MISSING_TTL_MS = 24 * 60 * 60 * 1000; // retry missing icons daily
const MAX_ICON_BYTES = 100 * 1024;
const HOST_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

export type Favicon = { contentType: string; data: Buffer } | null;

export function isValidHost(host: string) {
  return HOST_RE.test(host);
}

/** Finds <link rel="icon" href="..."> in a page's HTML. */
export function findIconHref(html: string): string | null {
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = tag.match(/\brel\s*=\s*["']?([^"'>]+)/i)?.[1]?.toLowerCase() ?? "";
    if (!rel.split(/\s+/).some((r) => r === "icon" || r === "apple-touch-icon")) continue;
    const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1] ?? tag.match(/\bhref\s*=\s*([^\s>]+)/i)?.[1];
    if (href) return href;
  }
  return null;
}

async function tryIcon(url: string): Promise<Favicon> {
  try {
    const res = await safeFetch(url, { maxBytes: MAX_ICON_BYTES });
    const isImage =
      res.contentType.startsWith("image/") ||
      // Some servers send .ico files as octet-stream.
      (res.contentType === "application/octet-stream" && url.endsWith(".ico"));
    if (res.status === 200 && isImage && res.body.length > 0) {
      return { contentType: res.contentType.startsWith("image/") ? res.contentType : "image/x-icon", data: res.body };
    }
  } catch {
    // fall through to "no icon"
  }
  return null;
}

async function fetchFavicon(host: string): Promise<Favicon> {
  const base = `https://${host}/`;
  try {
    const page = await safeFetch(base, { maxBytes: 512 * 1024 });
    if (page.contentType.includes("html")) {
      const href = findIconHref(page.body.toString("utf8"));
      if (href) {
        const icon = await tryIcon(new URL(href, page.finalUrl).toString());
        if (icon) return icon;
      }
    }
  } catch {
    // site unreachable or blocked; still try /favicon.ico below
  }
  return tryIcon(new URL("/favicon.ico", base).toString());
}

export async function getFavicon(host: string): Promise<Favicon> {
  const [cached] = await db.select().from(favicons).where(eq(favicons.host, host));
  if (cached) {
    const age = Date.now() - cached.fetchedAt.getTime();
    if (cached.status === "ok" && age < OK_TTL_MS && cached.data && cached.contentType) {
      return { contentType: cached.contentType, data: cached.data };
    }
    if (cached.status === "missing" && age < MISSING_TTL_MS) return null;
  }

  const icon = await fetchFavicon(host);
  const row = {
    host,
    status: icon ? ("ok" as const) : ("missing" as const),
    contentType: icon?.contentType ?? null,
    data: icon?.data ?? null,
    fetchedAt: new Date(),
  };
  await db.insert(favicons).values(row).onDuplicateKeyUpdate({ set: row });
  return icon;
}

