/**
 * Page sharing: a page owner turns on a link (/s/<token>), and anyone with it
 * can view the page read-only and save a copy into their own SyncPads.
 *
 * - Links only by default; notes are shared only if the owner turns that on
 *   (notes often hold private context an AI saved).
 * - Only what's on the page is shared: never the Agent Inbox, trash, summaries,
 *   or anything about the owner beyond their first name.
 * - Turning sharing off deletes the token, so old links stop working. Turning
 *   it back on makes a new link.
 */
import { randomBytes } from "node:crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { groups, items, pages, users } from "@/db/schema";
import { FILE_FORMAT, FILE_VERSION, type SyncPadsFile } from "@/lib/syncpads-file";
import { NotFoundError, importSyncPadsFile, write } from "./start-page";

export type ShareInfo = { token: string; includeNotes: boolean; copies: number; sharedAt: Date | null };

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;
export const isShareToken = (t: string) => TOKEN_RE.test(t);

const newToken = () => randomBytes(24).toString("base64url"); // 32 characters, 192 bits

async function ownedPage(userId: string, pageId: string) {
  const [row] = await db
    .select({ shareToken: pages.shareToken, shareNotes: pages.shareNotes, shareCopies: pages.shareCopies, sharedAt: pages.sharedAt })
    .from(pages)
    .where(and(eq(pages.id, pageId), eq(pages.userId, userId)));
  if (!row) throw new NotFoundError("Page");
  return row;
}

/** Turns sharing on (keeping the current link if there is one) and/or changes whether notes are included. */
export async function sharePage(userId: string, pageId: string, input: { includeNotes?: boolean }) {
  const current = await ownedPage(userId, pageId);
  const token = current.shareToken ?? newToken();
  const includeNotes = input.includeNotes ?? (current.shareToken ? current.shareNotes : false);
  return write(userId, async (tx) => {
    await tx
      .update(pages)
      .set({
        shareToken: token,
        shareNotes: includeNotes,
        ...(current.shareToken ? {} : { sharedAt: new Date(), shareCopies: 0 }),
      })
      .where(and(eq(pages.id, pageId), eq(pages.userId, userId)));
    return { share: { token, includeNotes, copies: current.shareToken ? current.shareCopies : 0 } };
  });
}

/** Turns sharing off. The old link stops working immediately. */
export async function unsharePage(userId: string, pageId: string) {
  await ownedPage(userId, pageId);
  return write(userId, async (tx) => {
    await tx
      .update(pages)
      .set({ shareToken: null, shareNotes: false, sharedAt: null, shareCopies: 0 })
      .where(and(eq(pages.id, pageId), eq(pages.userId, userId)));
    return { share: null };
  });
}

export type SharedItem =
  | { type: "link"; url: string; title: string | null; host: string }
  | { type: "note"; title: string | null; body: string | null };
export type SharedPage = {
  pageId: string;
  ownerId: string;
  name: string;
  ownerName: string;
  layout: string;
  includeNotes: boolean;
  sharedAt: Date | null;
  copies: number;
  groups: { name: string; layout: "list" | "tiles"; items: SharedItem[] }[];
  links: number;
  notes: number;
};

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** What a visitor sees at /s/<token>, or null when the link isn't valid (never shared, or sharing turned off). */
export async function getSharedPage(token: string): Promise<SharedPage | null> {
  if (!isShareToken(token)) return null;
  const [page] = await db
    .select({
      id: pages.id,
      userId: pages.userId,
      name: pages.name,
      layout: pages.layout,
      shareNotes: pages.shareNotes,
      sharedAt: pages.sharedAt,
      copies: pages.shareCopies,
      ownerName: users.name,
    })
    .from(pages)
    .innerJoin(users, eq(users.id, pages.userId))
    .where(eq(pages.shareToken, token));
  if (!page) return null;

  const groupRows = await db
    .select({ id: groups.id, name: groups.name, layout: groups.layout })
    .from(groups)
    .where(eq(groups.pageId, page.id))
    .orderBy(asc(groups.position));
  const itemRows = groupRows.length
    ? await db
        .select({ groupId: items.groupId, type: items.type, url: items.url, title: items.title, noteBody: items.noteBody })
        .from(items)
        .where(and(eq(items.userId, page.userId), eq(items.status, "active"), inArray(items.groupId, groupRows.map((g) => g.id))))
        .orderBy(asc(items.position), asc(items.createdAt))
    : [];

  let links = 0;
  let notes = 0;
  const shared = groupRows
    .map((g) => ({
      name: g.name,
      layout: g.layout,
      items: itemRows
        .filter((i) => i.groupId === g.id)
        .flatMap((i): SharedItem[] => {
          if (i.type === "link" && i.url) {
            links++;
            return [{ type: "link", url: i.url, title: i.title, host: hostOf(i.url) }];
          }
          if (i.type === "note" && page.shareNotes) {
            notes++;
            return [{ type: "note", title: i.title, body: i.noteBody }];
          }
          return [];
        }),
    }))
    .filter((g) => g.items.length > 0);

  return {
    pageId: page.id,
    ownerId: page.userId,
    name: page.name,
    ownerName: page.ownerName.trim().split(/\s+/)[0] || "Someone",
    layout: page.layout,
    includeNotes: page.shareNotes,
    sharedAt: page.sharedAt,
    copies: page.copies,
    groups: shared,
    links,
    notes,
  };
}

/** Saves a copy of a shared page into the visitor's own SyncPads, as a new page. */
export async function copySharedPage(userId: string, token: string) {
  const page = await getSharedPage(token);
  if (!page) throw new NotFoundError("Shared page");
  const file: SyncPadsFile = {
    format: FILE_FORMAT,
    version: FILE_VERSION,
    pages: [
      {
        name: page.name,
        layout: page.layout as SyncPadsFile["pages"][number]["layout"],
        groups: page.groups.map((g) => ({
          name: g.name,
          layout: g.layout,
          items: g.items.map((i) => (i.type === "link" ? { type: "link" as const, url: i.url, title: i.title } : { type: "note" as const, title: i.title, body: i.body })),
        })),
      },
    ],
  };
  const result = await importSyncPadsFile(userId, file);
  if (userId !== page.ownerId) {
    await db.update(pages).set({ shareCopies: sql`${pages.shareCopies} + 1` }).where(eq(pages.id, page.pageId));
  }
  return result;
}

/** True when `host` is one of the links on the shared page (so the favicon proxy can't be used for anything else). */
export async function sharedPageHasHost(token: string, host: string) {
  const page = await getSharedPage(token);
  return Boolean(page?.groups.some((g) => g.items.some((i) => i.type === "link" && new URL(i.url).hostname.toLowerCase() === host)));
}
