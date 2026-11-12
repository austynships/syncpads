/**
 * Turns a fetched HTML page into a clean title, description and plain text
 * snapshot (SP-13). Pure functions, no network.
 */
import { Parser } from "htmlparser2";

/** Text inside these elements is never part of the snapshot. */
const SKIP = new Set(["script", "style", "noscript", "template", "svg", "iframe", "canvas", "head", "nav", "footer", "form", "button", "select"]);
/** These end a line of text. */
const BLOCK = new Set([
  "p", "div", "section", "article", "main", "header", "aside", "li", "ul", "ol", "br", "hr", "tr", "table",
  "h1", "h2", "h3", "h4", "h5", "h6", "pre", "blockquote", "dd", "dt", "figcaption",
]);

export const MAX_SNAPSHOT_CHARS = 100_000;

export type Extracted = { title: string | null; description: string | null; text: string };

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function extractFromHtml(html: string): Extracted {
  let title = "";
  let inTitle = false;
  let ogTitle: string | null = null;
  let description: string | null = null;
  let skipDepth = 0;
  const lines: string[] = [];
  let line = "";
  let length = 0;

  const endLine = () => {
    const text = clean(line);
    if (text && length < MAX_SNAPSHOT_CHARS) {
      lines.push(text);
      length += text.length + 1;
    }
    line = "";
  };

  const parser = new Parser(
    {
      onopentag(name, attrs) {
        if (name === "title") inTitle = true;
        if (name === "meta") {
          const key = (attrs.property ?? attrs.name ?? "").toLowerCase();
          const content = attrs.content ? clean(attrs.content) : "";
          if (content) {
            if (key === "og:title" && !ogTitle) ogTitle = content;
            if ((key === "description" || key === "og:description") && !description) description = content;
          }
        }
        if (SKIP.has(name)) skipDepth++;
        if (BLOCK.has(name)) endLine();
      },
      ontext(text) {
        if (inTitle) title += text;
        else if (skipDepth === 0) line += text;
      },
      onclosetag(name) {
        if (name === "title") inTitle = false;
        if (SKIP.has(name)) skipDepth = Math.max(0, skipDepth - 1);
        if (BLOCK.has(name)) endLine();
      },
    },
    { decodeEntities: true, lowerCaseTags: true, lowerCaseAttributeNames: true },
  );
  parser.write(html);
  parser.end();
  endLine();

  const bestTitle = clean(ogTitle ?? title) || null;
  return {
    title: bestTitle ? bestTitle.slice(0, 512) : null,
    description: description ? (description as string).slice(0, 1000) : null,
    text: lines.join("\n").slice(0, MAX_SNAPSHOT_CHARS),
  };
}

/** Plain text of a note's (already sanitized) HTML. */
export function noteText(html: string): string {
  return extractFromHtml(`<body>${html}</body>`).text;
}
