/**
 * Turns user input into a safe http(s) URL, or returns null.
 * "example.com" becomes "https://example.com". javascript:, data: and other
 * schemes are rejected so a saved link can never run code.
 */
export function normalizeUrl(input: string): string | null {
  const text = input.trim();
  if (!text || /\s/.test(text) || text.length > 2048) return null;

  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  // Require something that looks like a real host ("localhost" or has a dot).
  if (!url.hostname || (!url.hostname.includes(".") && url.hostname !== "localhost")) return null;
  return url.toString();
}

/** Short display version of a URL: host without "www.". */
export function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

