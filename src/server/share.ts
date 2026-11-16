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
 * - Edit links ("edit" role): signed-in people who open the link can join the
 *   page. It shows up as a tab in their workspace and they can edit everything
 *   on it, notes included. Turning sharing off, or back to view only, removes them.
 */
import { randomBytes } from "node:crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { groups, items, pageMembers, pages, userSettings, users, widgets, type Wallpaper } from "@/db/schema";
import type { AnyWidgetConfig, FeedData, WeatherData, WidgetDTO } from "@/lib/widgets";
import { FILE_FORMAT, FILE_VERSION, type SyncPadsFile } from "@/lib/syncpads-file";
import { notifyJoined, notifyLeft, notifyLostAccess } from "./notifications";
import { loadWidgetData } from "./widgets";
import { InvalidInputError, NotFoundError, importSyncPadsFile, nextPagePosition, pageAccess, write } from "./start-page";

export type ShareRole = "view" | "edit";

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;
export const isShareToken = (t: string) => TOKEN_RE.test(t);

const newToken = () => randomBytes(24).toString("base64url"); // 32 characters, 192 bits

async function ownedPage(userId: string, pageId: string) {
  const [row] = await db
    .select({
      shareToken: pages.shareToken,
      shareNotes: pages.shareNotes,
      shareRole: pages.shareRole,
      shareCopies: pages.shareCopies,
      sharedAt: pages.sharedAt,
    })
    .from(pages)
    .where(and(eq(pages.id, pageId), eq(pages.userId, userId)));
  if (!row) throw new NotFoundError("Page");
  return row;
}

/**
 * Turns sharing on (keeping the current link if there is one), or changes it:
 * whether notes are included on the view page, and whether the link lets people edit.
 * Switching an edit link to view only removes everyone who joined to edit.
 */
export async function sharePage(userId: string, pageId: string, input: { includeNotes?: boolean; role?: ShareRole }) {
  const current = await ownedPage(userId, pageId);
  const token = current.shareToken ?? newToken();
  const includeNotes = input.includeNotes ?? (current.shareToken ? current.shareNotes : false);
  const role = input.role ?? (current.shareToken ? current.shareRole : "view");
  return write(userId, async (tx, touch) => {
    if (role === "view") {
      await touch(pageId); // editors lose the page: refresh their workspaces
      const editors = await tx.select({ id: pageMembers.userId }).from(pageMembers).where(eq(pageMembers.pageId, pageId));
      await notifyLostAccess(tx, userId, pageId, editors.map((e) => e.id), "view_only");
      await tx.delete(pageMembers).where(eq(pageMembers.pageId, pageId));
    }
    await tx
      .update(pages)
      .set({
        shareToken: token,
        shareNotes: includeNotes,
        shareRole: role,
        ...(current.shareToken ? {} : { sharedAt: new Date(), shareCopies: 0 }),
      })
      .where(and(eq(pages.id, pageId), eq(pages.userId, userId)));
    const [{ n }] = await tx.select({ n: sql<number>`COUNT(*)` }).from(pageMembers).where(eq(pageMembers.pageId, pageId));
    await touch(pageId);
    return { share: { token, role, includeNotes, copies: current.shareToken ? current.shareCopies : 0, editors: Number(n) } };
  });
}

/** Turns sharing off. The link stops working immediately and everyone who joined to edit loses the page. */
export async function unsharePage(userId: string, pageId: string) {
  await ownedPage(userId, pageId);
  return write(userId, async (tx, touch) => {
    await touch(pageId);
    const editors = await tx.select({ id: pageMembers.userId }).from(pageMembers).where(eq(pageMembers.pageId, pageId));
    await notifyLostAccess(tx, userId, pageId, editors.map((e) => e.id), "unshared");
    await tx.delete(pageMembers).where(eq(pageMembers.pageId, pageId));
    await tx
      .update(pages)
      .set({ shareToken: null, shareNotes: false, shareRole: "view", sharedAt: null, shareCopies: 0 })
      .where(and(eq(pages.id, pageId), eq(pages.userId, userId)));
    return { share: null };
  });
}

// ---------- editors ----------

/**
 * Joins a page through its edit link: it becomes a tab in the user's
 * workspace. Joining again (or the owner opening their own link) just returns the page.
 */
export async function joinSharedPage(userId: string, token: string) {
  if (!isShareToken(token)) throw new NotFoundError("Shared page");
  const [page] = await db
    .select({ id: pages.id, ownerId: pages.userId, role: pages.shareRole })
    .from(pages)
    .where(eq(pages.shareToken, token));
  if (!page) throw new NotFoundError("Shared page");
  if (page.ownerId === userId) return { pageId: page.id, joined: false, revision: undefined };
  if (page.role !== "edit") throw new InvalidInputError("This link is view only. Ask the owner for an edit link.");
  return write(userId, async (tx, touch) => {
    const [existing] = await tx
      .select({ pageId: pageMembers.pageId })
      .from(pageMembers)
      .where(and(eq(pageMembers.pageId, page.id), eq(pageMembers.userId, userId)));
    if (existing) return { pageId: page.id, joined: false };
    await tx.insert(pageMembers).values({ pageId: page.id, userId, position: await nextPagePosition(tx, userId) });
    await touch(page.id); // the owner sees one more editor
    await notifyJoined(tx, userId, page.id, page.ownerId);
    return { pageId: page.id, joined: true };
  });
}

/** An editor leaves a shared page: it disappears from their workspace. */
export async function leaveSharedPage(userId: string, pageId: string) {
  return write(userId, async (tx, touch) => {
    const access = await pageAccess(tx, userId, pageId);
    if (access.role === "owner") throw new InvalidInputError("You own this page. To stop sharing it, use Share → Stop sharing.");
    await tx.delete(pageMembers).where(and(eq(pageMembers.pageId, pageId), eq(pageMembers.userId, userId)));
    await touch(pageId);
    await notifyLeft(tx, userId, pageId, access.ownerId);
    return {};
  });
}

export async function isPageMember(pageId: string, userId: string) {
  const [row] = await db
    .select({ pageId: pageMembers.pageId })
    .from(pageMembers)
    .where(and(eq(pageMembers.pageId, pageId), eq(pageMembers.userId, userId)));
  return Boolean(row);
}

/** Who joined the owner's page to edit it (owner only). */
export async function listEditors(ownerId: string, pageId: string) {
  await ownedPage(ownerId, pageId);
  return db
    .select({ userId: users.id, name: users.name, email: users.email, joinedAt: pageMembers.createdAt })
    .from(pageMembers)
    .innerJoin(users, eq(users.id, pageMembers.userId))
    .where(eq(pageMembers.pageId, pageId))
    .orderBy(asc(pageMembers.createdAt));
}

/** The owner removes one editor. */
export async function removeEditor(ownerId: string, pageId: string, editorId: string) {
  await ownedPage(ownerId, pageId);
  return write(ownerId, async (tx, touch) => {
    await touch(pageId);
    const removed = await tx.delete(pageMembers).where(and(eq(pageMembers.pageId, pageId), eq(pageMembers.userId, editorId)));
    if ((removed as unknown as [{ affectedRows: number }])[0].affectedRows > 0) {
      await notifyLostAccess(tx, ownerId, pageId, [editorId], "removed");
    }
    return {};
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
  role: ShareRole;
  includeNotes: boolean;
  sharedAt: Date | null;
  copies: number;
  /** The owner's look, so the shared page matches their start page. */
  theme: "system" | "light" | "dark";
  wallpaper: Wallpaper | null;
  groups: { name: string; layout: "list" | "tiles"; items: SharedItem[] }[];
  /** Widgets at the top of the page. To-do lists count as notes: shown only when notes are included. */
  widgets: WidgetDTO[];
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
      shareRole: pages.shareRole,
      sharedAt: pages.sharedAt,
      copies: pages.shareCopies,
      ownerName: users.name,
      theme: userSettings.theme,
      wallpaper: userSettings.wallpaper,
    })
    .from(pages)
    .innerJoin(users, eq(users.id, pages.userId))
    .leftJoin(userSettings, eq(userSettings.userId, pages.userId))
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

  const widgetRows = await db.select().from(widgets).where(eq(widgets.pageId, page.id)).orderBy(asc(widgets.position));
  const sharedWidgets: WidgetDTO[] = widgetRows
    .filter((w) => w.type !== "todo" || page.shareNotes)
    .map((w) => ({ id: w.id, type: w.type, config: (w.config ?? {}) as AnyWidgetConfig, position: w.position }));

  return {
    widgets: sharedWidgets,
    pageId: page.id,
    ownerId: page.userId,
    name: page.name,
    ownerName: page.ownerName.trim().split(/\s+/)[0] || "Someone",
    layout: page.layout,
    role: page.shareRole,
    includeNotes: page.shareNotes,
    sharedAt: page.sharedAt,
    copies: page.copies,
    theme: page.theme ?? "system",
    wallpaper: page.wallpaper ?? null,
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

/** Weather or feed data for a widget on a shared page, for visitors who may not be signed in. */
export async function sharedWidgetData(token: string, widgetId: string): Promise<WeatherData | FeedData> {
  const page = await getSharedPage(token);
  const widget = page?.widgets.find((w) => w.id === widgetId);
  if (!widget || (widget.type !== "weather" && widget.type !== "rss")) throw new NotFoundError("Widget");
  return loadWidgetData(widgetId);
}

/** True when `host` is one of the links on the shared page (so the favicon proxy can't be used for anything else). */
export async function sharedPageHasHost(token: string, host: string) {
  const page = await getSharedPage(token);
  return Boolean(page?.groups.some((g) => g.items.some((i) => i.type === "link" && new URL(i.url).hostname.toLowerCase() === host)));
}
