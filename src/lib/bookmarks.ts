/**
 * Bookmark import (SP-9): turns a bookmark tree into SyncPads pages and groups.
 *
 * Sources:
 *  - HTML bookmark files (the "Netscape" format that Chrome, Edge, Firefox,
 *    Safari and start.me export). Parsed by parseBookmarksHtml, which works in
 *    the browser and on the server (no DOM needed).
 *  - The Chrome extension, which sends chrome.bookmarks.getTree() converted to
 *    the same BookmarkNode shape.
 *
 * Mapping (planImport): SyncPads has two levels, pages and groups.
 *  - Each top-level folder becomes a page.
 *  - Links directly inside it go into a group called "Links".
 *  - Each subfolder becomes a group. Deeper folders become their own groups,
 *    named with their path ("Work / Clients").
 *  - Loose links at the top level go to a page called "Imported".
 *  Empty folders are skipped, and so are links that aren't http(s).
 */
import { normalizeUrl } from "./url";

export type BookmarkNode = {
  title: string;
  url?: string;
  children?: BookmarkNode[];
};

export type ImportLink = { url: string; title: string | null };
export type ImportGroup = { name: string; links: ImportLink[] };
export type ImportPage = { name: string; groups: ImportGroup[] };
export type ImportPlan = {
  pages: ImportPage[];
  linkCount: number;
  groupCount: number;
  skipped: number; // links dropped because their address isn't a web URL
};

export const IMPORT_LIMITS = {
  pages: 100,
  groups: 2000,
  links: 10_000,
  depth: 30,
};

const MAX_NAME = 255;
const MAX_TITLE = 512;

// ---------- HTML parsing ----------

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

function textOf(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
}

function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  if (!m) return undefined;
  return decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
}

/**
 * Parses a Netscape-format bookmark file into a tree.
 * A folder is an <H3> followed by a <DL> holding its contents; a link is an <A HREF>.
 * Returns the top-level nodes.
 */
export function parseBookmarksHtml(html: string): BookmarkNode[] {
  const root: BookmarkNode = { title: "", children: [] };
  const stack: BookmarkNode[] = [root];
  let pendingFolder: BookmarkNode | null = null;
  let openedRoot = false;

  // One pass over the interesting tags: <H3>…</H3>, <A …>…</A>, <DL>, </DL>.
  const token = /<h3\b[^>]*>([\s\S]*?)<\/h3>|(<a\b[^>]*>)([\s\S]*?)<\/a>|<dl\b[^>]*>|<\/dl\s*>/gi;
  for (const m of html.matchAll(token)) {
    const current = stack[stack.length - 1];
    const tag = m[0].slice(0, 3).toLowerCase();

    if (tag === "<h3") {
      pendingFolder = { title: textOf(m[1] ?? ""), children: [] };
      current.children!.push(pendingFolder);
    } else if (tag.startsWith("<a")) {
      const href = attr(m[2] ?? "", "href");
      if (href) current.children!.push({ title: textOf(m[3] ?? ""), url: href.trim() });
      pendingFolder = null;
    } else if (tag === "<dl") {
      if (pendingFolder) {
        stack.push(pendingFolder);
        pendingFolder = null;
      } else if (!openedRoot) {
        openedRoot = true; // the outermost <DL> is the file's root list
      } else {
        // A list with no heading: keep its contents in the current folder.
        stack.push(current);
      }
    } else if (tag === "</d") {
      if (stack.length > 1) stack.pop();
      pendingFolder = null;
    }
  }
  return root.children!;
}

// ---------- tree -> pages and groups ----------

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function folderName(title: string, fallback: string): string {
  return clip(title.trim() || fallback, MAX_NAME);
}

/** Builds the pages and groups an import will create. Throws if it's over the limits. */
export function planImport(nodes: BookmarkNode[]): ImportPlan {
  const plan: ImportPlan = { pages: [], linkCount: 0, groupCount: 0, skipped: 0 };

  const toLink = (node: BookmarkNode): ImportLink | null => {
    const url = node.url ? normalizeUrl(node.url) : null;
    if (!url) {
      plan.skipped++;
      return null;
    }
    const title = node.title.trim();
    return { url, title: title ? clip(title, MAX_TITLE) : null };
  };

  const looseLinks: ImportLink[] = [];

  for (const top of nodes) {
    if (!top.children) {
      const link = toLink(top);
      if (link) looseLinks.push(link);
      continue;
    }

    const page: ImportPage = { name: folderName(top.title, "Imported"), groups: [] };
    const direct: ImportLink[] = [];
    for (const child of top.children) {
      if (child.children) continue;
      const link = toLink(child);
      if (link) direct.push(link);
    }
    if (direct.length) page.groups.push({ name: "Links", links: direct });

    // Every subfolder (at any depth) becomes a group named by its path.
    const walk = (folder: BookmarkNode, path: string, depth: number) => {
      if (depth > IMPORT_LIMITS.depth) return;
      const links: ImportLink[] = [];
      for (const child of folder.children ?? []) {
        if (child.children) continue;
        const link = toLink(child);
        if (link) links.push(link);
      }
      if (links.length) page.groups.push({ name: clip(path, MAX_NAME), links });
      for (const child of folder.children ?? []) {
        if (child.children) walk(child, `${path} / ${child.title.trim() || "Folder"}`, depth + 1);
      }
    };
    for (const child of top.children) {
      if (child.children) walk(child, child.title.trim() || "Folder", 1);
    }

    if (page.groups.length) plan.pages.push(page);
  }

  if (looseLinks.length) plan.pages.push({ name: "Imported", groups: [{ name: "Links", links: looseLinks }] });

  for (const page of plan.pages) {
    plan.groupCount += page.groups.length;
    for (const group of page.groups) plan.linkCount += group.links.length;
  }

  if (plan.pages.length > IMPORT_LIMITS.pages) {
    throw new Error(`That's ${plan.pages.length} top-level folders; the most one import can create is ${IMPORT_LIMITS.pages} pages.`);
  }
  if (plan.groupCount > IMPORT_LIMITS.groups) {
    throw new Error(`That's ${plan.groupCount} folders; the most one import can create is ${IMPORT_LIMITS.groups} groups.`);
  }
  if (plan.linkCount > IMPORT_LIMITS.links) {
    throw new Error(`That's ${plan.linkCount} links; the most one import can add is ${IMPORT_LIMITS.links.toLocaleString("en-US")}.`);
  }
  return plan;
}

/** Counts links in a tree (for previews before planning). */
export function countLinks(nodes: BookmarkNode[]): number {
  let n = 0;
  for (const node of nodes) n += node.children ? countLinks(node.children) : node.url ? 1 : 0;
  return n;
}
