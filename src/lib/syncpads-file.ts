/**
 * The SyncPads export file (SP-10): every page, group, link and note, in a
 * plain JSON file people can keep as a backup or import into another account.
 * Shared by the server (export and import) and the browser (import preview).
 *
 * Also builds the browser-bookmarks HTML export: pages become folders, groups
 * become subfolders. Notes aren't bookmarks, so the HTML export leaves them out.
 */
import { z } from "zod";

export const FILE_FORMAT = "syncpads";
export const FILE_VERSION = 1;

export const TRANSFER_LIMITS = {
  pages: 100,
  groups: 2_000,
  links: 10_000,
  notes: 2_000,
  noteChars: 200_000,
};

const name = z.string().trim().min(1).max(255);

const linkSchema = z.object({
  type: z.literal("link"),
  url: z.string().min(1).max(2048),
  title: z.string().max(512).nullish(),
  // Written on export for reference; summaries and tags are remade on import.
  summary: z.string().nullish(),
  tags: z.array(z.string()).nullish(),
});

const noteSchema = z.object({
  type: z.literal("note"),
  title: z.string().max(512).nullish(),
  body: z.string().max(TRANSFER_LIMITS.noteChars, "A note in that file is too long.").nullish(),
});

const groupSchema = z.object({
  name,
  layout: z.enum(["list", "tiles"]).optional(),
  items: z.array(z.discriminatedUnion("type", [linkSchema, noteSchema])).max(TRANSFER_LIMITS.links),
});

const pageSchema = z.object({
  name,
  layout: z.enum(["auto", "1", "2", "3", "4", "5"]).optional(),
  hiddenFromAgents: z.boolean().optional(),
  groups: z.array(groupSchema).max(TRANSFER_LIMITS.groups),
});

export const syncpadsFileSchema = z
  .object({
    format: z.literal(FILE_FORMAT),
    version: z.number().int().min(1),
    exportedAt: z.string().optional(),
    pages: z.array(pageSchema).min(1, "That file has no pages.").max(TRANSFER_LIMITS.pages, `One import can create at most ${TRANSFER_LIMITS.pages} pages.`),
  })
  .superRefine((file, ctx) => {
    if (file.version > FILE_VERSION) {
      ctx.addIssue({ code: "custom", message: "That file is from a newer version of SyncPads. Refresh the page and try again." });
    }
    const c = countFile(file);
    if (c.groups > TRANSFER_LIMITS.groups) ctx.addIssue({ code: "custom", message: `That file has ${c.groups} groups; the most one import can create is ${TRANSFER_LIMITS.groups}.` });
    if (c.links > TRANSFER_LIMITS.links) ctx.addIssue({ code: "custom", message: `That file has ${c.links} links; the most one import can add is ${TRANSFER_LIMITS.links.toLocaleString("en-US")}.` });
    if (c.notes > TRANSFER_LIMITS.notes) ctx.addIssue({ code: "custom", message: `That file has ${c.notes} notes; the most one import can add is ${TRANSFER_LIMITS.notes.toLocaleString("en-US")}.` });
  });

export type SyncPadsFile = z.infer<typeof syncpadsFileSchema>;
export type FilePage = SyncPadsFile["pages"][number];

export function countFile(file: { pages: { groups: { items: { type: string }[] }[] }[] }) {
  let groups = 0;
  let links = 0;
  let notes = 0;
  for (const page of file.pages) {
    groups += page.groups.length;
    for (const group of page.groups) {
      for (const item of group.items) item.type === "link" ? links++ : notes++;
    }
  }
  return { pages: file.pages.length, groups, links, notes };
}

/** True when parsed JSON looks like a SyncPads export (before full validation). */
export function looksLikeSyncPadsFile(data: unknown): boolean {
  return typeof data === "object" && data !== null && (data as { format?: unknown }).format === FILE_FORMAT;
}

/** Parses a SyncPads file; throws an Error with a plain message when it isn't valid. */
export function parseSyncPadsFile(data: unknown): SyncPadsFile {
  const result = syncpadsFileSchema.safeParse(data);
  if (!result.success) throw new Error(result.error.issues[0]?.message ?? "That isn't a valid SyncPads file.");
  return result.data;
}

// ---------- browser bookmarks HTML ----------

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Netscape bookmark file, which Chrome, Edge, Firefox and Safari can import.
 * Each page is a folder and each group a subfolder. Notes are left out.
 */
export function toBookmarksHtml(pages: FilePage[]): string {
  const lines = [
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
    "<!-- Exported from SyncPads. Import it into your browser or into SyncPads. -->",
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    "<TITLE>Bookmarks</TITLE>",
    "<H1>Bookmarks</H1>",
    "<DL><p>",
  ];
  for (const page of pages) {
    lines.push(`    <DT><H3>${escapeHtml(page.name)}</H3>`, "    <DL><p>");
    for (const group of page.groups) {
      const links = group.items.filter((i) => i.type === "link");
      if (links.length === 0) continue;
      lines.push(`        <DT><H3>${escapeHtml(group.name)}</H3>`, "        <DL><p>");
      for (const link of links) {
        lines.push(`            <DT><A HREF="${escapeHtml(link.url)}">${escapeHtml(link.title || link.url)}</A>`);
      }
      lines.push("        </DL><p>");
    }
    lines.push("    </DL><p>");
  }
  lines.push("</DL><p>", "");
  return lines.join("\n");
}

/** A file name like "syncpads-2026-11-15.json" or "syncpads-work-2026-11-15.html". */
export function exportFileName(ext: "json" | "html", pageName?: string) {
  const day = new Date().toISOString().slice(0, 10);
  const slug = pageName
    ?.toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `syncpads-${slug ? `${slug}-` : ""}${day}.${ext}`;
}
