/**
 * A `?next=` value is only followed when it's a path on this site, never
 * another domain ("//evil.com", "/\evil.com" or "https://...").
 */
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;
  return raw.slice(0, 512);
}

/** Reads and checks ?next= from the current URL (browser only). */
export function nextFromLocation(): string | null {
  return safeNext(new URLSearchParams(window.location.search).get("next"));
}
