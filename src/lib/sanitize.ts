import sanitizeHtml from "sanitize-html";

/**
 * Cleans note HTML from the rich-text editor before it is stored.
 * Only formatting tags survive; scripts, styles, event handlers and
 * non-http(s) links are removed. Runs on every write, including future
 * agent writes, so stored notes are always safe to render.
 */
export function sanitizeNoteHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "br", "strong", "b", "em", "i", "s", "u", "code", "pre", "blockquote",
      "ul", "ol", "li", "h1", "h2", "h3", "a", "hr",
    ],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer nofollow" }),
    },
  }).trim();
}

