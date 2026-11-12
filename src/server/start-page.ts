/**
 * Start page data access (Phase 2). Every function takes the signed-in
 * user's id and only ever touches that user's rows.
 * Every write bumps user_settings.revision in the same transaction (SP-6 sync).
 */
import { and, asc, eq, inArray, max, sql } from "drizzle-orm";
import { db, type Db } from "@/db";
import { activityLog, agents, groups, itemEnrichment, items, pages, userSettings, type Wallpaper } from "@/db/schema";
import { sanitizeNoteHtml } from "@/lib/sanitize";
import type {
  GroupDTO,
  GroupLayout,
  InboxItemDTO,
  ItemDTO,
  PageDTO,
  PageLayout,
  StateDTO,
  Theme,
} from "@/lib/start-page-types";
import { normalizeUrl } from "@/lib/url";
import { planImport, type BookmarkNode, type ImportLink } from "@/lib/bookmarks";
import { aiAvailability } from "./enrichment/ai";
import { enqueue, requeueForAi } from "./enrichment/queue";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
  }
}
export class InvalidInputError extends Error {}

// ---------- helpers ----------

async function bumpRevision(tx: Tx, userId: string): Promise<number> {
  await tx
    .update(userSettings)
    .set({ revision: sql`${userSettings.revision} + 1` })
    .where(eq(userSettings.userId, userId));
  const [row] = await tx
    .select({ revision: userSettings.revision })
    .from(userSettings)
    .where(eq(userSettings.userId, userId));
  return row?.revision ?? 0;
}

function affected(result: unknown): number {
  return (result as [{ affectedRows: number }])[0].affectedRows;
}

async function assertPage(tx: Tx, userId: string, pageId: string) {
  const [row] = await tx
    .select({ id: pages.id })
    .from(pages)
    .where(and(eq(pages.id, pageId), eq(pages.userId, userId)));
  if (!row) throw new NotFoundError("Page");
}

async function assertGroup(tx: Tx, userId: string, groupId: string) {
  const [row] = await tx
    .select({ id: groups.id })
    .from(groups)
    .where(and(eq(groups.id, groupId), eq(groups.userId, userId)));
  if (!row) throw new NotFoundError("Group");
}

/** Run a write in a transaction and return its result plus the new revision. */
async function write<T extends object>(userId: string, fn: (tx: Tx) => Promise<T>) {
  await ensureUserSetup(userId);
  return db.transaction(async (tx) => {
    const result = await fn(tx);
    const revision = await bumpRevision(tx, userId);
    return { ...result, revision };
  });
}

// ---------- setup and reads ----------

/**
 * Makes sure the user has a settings row and at least one page.
 * New users get a "Home" page with an empty "Favorites" group.
 * The settings row is locked so two tabs can't both create a first page.
 */
export async function ensureUserSetup(userId: string) {
  // Fast path: already set up (every request after the first).
  const [ready] = await db
    .select({ id: pages.id })
    .from(pages)
    .innerJoin(userSettings, eq(userSettings.userId, pages.userId))
    .where(eq(pages.userId, userId))
    .limit(1);
  if (ready) return;

  // Create the settings row on its own first. Doing this inside the locking
  // transaction deadlocks when two tabs open at the same moment.
  await db.insert(userSettings).ignore().values({ userId, wallpaper: { type: "none" } });

  await db.transaction(async (tx) => {
    await tx.select().from(userSettings).where(eq(userSettings.userId, userId)).for("update");
    const [existing] = await tx.select({ id: pages.id }).from(pages).where(eq(pages.userId, userId)).limit(1);
    if (existing) return;

    const pageId = crypto.randomUUID();
    await tx.insert(pages).values({ id: pageId, userId, name: "Home", position: 0 });
    await tx.insert(groups).values({ userId, pageId, name: "Favorites", position: 0, layout: "tiles" });
  });
}

export async function getRevision(userId: string): Promise<number> {
  const [row] = await db
    .select({ revision: userSettings.revision })
    .from(userSettings)
    .where(eq(userSettings.userId, userId));
  return row?.revision ?? 0;
}

/** Everything the start page needs, in one response. Inbox and trashed items are excluded. */
export async function getState(userId: string): Promise<StateDTO> {
  await ensureUserSetup(userId);

  const [settingsRow] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
  const pageRows = await db.select().from(pages).where(eq(pages.userId, userId)).orderBy(asc(pages.position));
  const groupRows = await db.select().from(groups).where(eq(groups.userId, userId)).orderBy(asc(groups.position));
  const itemRows = await db
    .select()
    .from(items)
    .where(and(eq(items.userId, userId), eq(items.status, "active")))
    .orderBy(asc(items.position));
  const enrichmentRows = await db
    .select({ itemId: itemEnrichment.itemId, summary: itemEnrichment.summary, tags: itemEnrichment.tags })
    .from(itemEnrichment)
    .where(eq(itemEnrichment.userId, userId));
  const enrichment = new Map(enrichmentRows.map((e) => [e.itemId, e]));

  const itemsByGroup = new Map<string, ItemDTO[]>();
  for (const i of itemRows) {
    const list = itemsByGroup.get(i.groupId) ?? [];
    const e = enrichment.get(i.id);
    list.push({
      id: i.id,
      type: i.type,
      url: i.url,
      title: i.title,
      noteBody: i.noteBody,
      position: i.position,
      summary: e?.summary ?? null,
      tags: e?.tags ?? null,
    });
    itemsByGroup.set(i.groupId, list);
  }
  const groupsByPage = new Map<string, GroupDTO[]>();
  for (const g of groupRows) {
    const list = groupsByPage.get(g.pageId) ?? [];
    list.push({ id: g.id, name: g.name, layout: g.layout, position: g.position, items: itemsByGroup.get(g.id) ?? [] });
    groupsByPage.set(g.pageId, list);
  }

  return {
    inbox: await getInbox(userId),
    revision: settingsRow?.revision ?? 0,
    settings: {
      theme: settingsRow?.theme ?? "system",
      wallpaper: settingsRow?.wallpaper ?? { type: "none" },
      aiEnabled: settingsRow?.aiEnabled ?? false,
      aiAvailable: aiAvailability(),
    },
    pages: pageRows.map(
      (p): PageDTO => ({
        id: p.id,
        name: p.name,
        layout: (p.layout as PageLayout) ?? "auto",
        position: p.position,
        hiddenFromAgents: p.hiddenFromAgents,
        groups: groupsByPage.get(p.id) ?? [],
      }),
    ),
  };
}

// ---------- Agent Inbox (SP-16) ----------

async function getInbox(userId: string): Promise<InboxItemDTO[]> {
  const rows = await db
    .select({
      id: items.id,
      url: items.url,
      title: items.title,
      groupId: items.groupId,
      pageId: groups.pageId,
      agentName: agents.name,
      createdAt: items.createdAt,
      summary: itemEnrichment.summary,
    })
    .from(items)
    .innerJoin(groups, eq(groups.id, items.groupId))
    .leftJoin(agents, eq(agents.id, items.createdByAgentId))
    .leftJoin(itemEnrichment, eq(itemEnrichment.itemId, items.id))
    .where(and(eq(items.userId, userId), eq(items.status, "inbox")))
    .orderBy(asc(items.createdAt));
  if (rows.length === 0) return [];
  // The agent's reason and note are on its add_link log entry.
  const logs = await db
    .select({ itemId: activityLog.itemId, reason: activityLog.reason, after: activityLog.after })
    .from(activityLog)
    .where(and(eq(activityLog.userId, userId), eq(activityLog.action, "add_link"), inArray(activityLog.itemId, rows.map((r) => r.id))));
  const byItem = new Map(logs.map((l) => [l.itemId, l]));
  return rows.map((r) => {
    const log = byItem.get(r.id);
    return {
      id: r.id,
      url: r.url,
      title: r.title,
      summary: r.summary,
      agentName: r.agentName ?? "An agent",
      reason: log?.reason ?? null,
      note: (log?.after as { note?: string | null } | null)?.note ?? null,
      pageId: r.pageId,
      groupId: r.groupId,
      createdAt: r.createdAt.toISOString(),
    };
  });
}

/** Approves an inbox link: it becomes a normal link at the end of the chosen group. */
export function approveInboxItem(userId: string, itemId: string, input: { groupId?: string; title?: string | null }) {
  return write(userId, async (tx) => {
    const [item] = await tx
      .select({ groupId: items.groupId })
      .from(items)
      .where(and(eq(items.id, itemId), eq(items.userId, userId), eq(items.status, "inbox")));
    if (!item) throw new NotFoundError("Inbox item");
    const groupId = input.groupId ?? item.groupId;
    await assertGroup(tx, userId, groupId);
    const [{ value }] = await tx
      .select({ value: max(items.position) })
      .from(items)
      .where(and(eq(items.groupId, groupId), eq(items.status, "active")));
    const title = input.title === undefined ? undefined : input.title?.trim().slice(0, 512) || null;
    await tx
      .update(items)
      .set({ status: "active", groupId, position: (value ?? -1) + 1, ...(title !== undefined ? { title } : {}) })
      .where(eq(items.id, itemId));
    return {};
  });
}

/** Dismisses an inbox link (moves it to the trash). */
export function dismissInboxItem(userId: string, itemId: string) {
  return write(userId, async (tx) => {
    const result = await tx
      .update(items)
      .set({ status: "trashed" })
      .where(and(eq(items.id, itemId), eq(items.userId, userId), eq(items.status, "inbox")));
    if (affected(result) === 0) throw new NotFoundError("Inbox item");
    return {};
  });
}

// ---------- settings ----------

export function updateSettings(userId: string, input: { theme?: Theme; wallpaper?: Wallpaper; aiEnabled?: boolean }) {
  return write(userId, async (tx) => {
    await tx.update(userSettings).set(input).where(eq(userSettings.userId, userId));
    // Turning smart features on: summarize and embed what's already saved.
    if (input.aiEnabled) await requeueForAi(tx, userId);
    return {};
  });
}

// ---------- pages ----------

export function createPage(userId: string, input: { name: string }) {
  return write(userId, async (tx) => {
    const [{ value }] = await tx.select({ value: max(pages.position) }).from(pages).where(eq(pages.userId, userId));
    const id = crypto.randomUUID();
    await tx.insert(pages).values({ id, userId, name: input.name, position: (value ?? -1) + 1 });
    // Every page starts with one group so there's somewhere to add links.
    await tx.insert(groups).values({ userId, pageId: id, name: "Links", position: 0 });
    return { id };
  });
}

export function updatePage(
  userId: string,
  pageId: string,
  input: { name?: string; layout?: PageLayout; hiddenFromAgents?: boolean },
) {
  return write(userId, async (tx) => {
    const result = await tx.update(pages).set(input).where(and(eq(pages.id, pageId), eq(pages.userId, userId)));
    if (affected(result) === 0) await assertPage(tx, userId, pageId); // 0 rows can also mean "no change"
    return {};
  });
}

export function deletePage(userId: string, pageId: string) {
  return write(userId, async (tx) => {
    await assertPage(tx, userId, pageId);
    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(pages)
      .where(eq(pages.userId, userId));
    if (Number(count) <= 1) throw new InvalidInputError("You need at least one page.");
    await tx.delete(pages).where(and(eq(pages.id, pageId), eq(pages.userId, userId)));
    return {};
  });
}

export function reorderPages(userId: string, ids: string[]) {
  return write(userId, async (tx) => {
    const owned = await tx
      .select({ id: pages.id })
      .from(pages)
      .where(and(eq(pages.userId, userId), inArray(pages.id, ids)));
    if (owned.length !== new Set(ids).size) throw new NotFoundError("Page");
    for (const [position, id] of ids.entries()) {
      await tx.update(pages).set({ position }).where(and(eq(pages.id, id), eq(pages.userId, userId)));
    }
    return {};
  });
}

// ---------- groups ----------

/**
 * Creates a group at the end of a page. `links` optionally fills it in the
 * same write (the extension's "save all tabs"); invalid addresses are skipped.
 */
export function createGroup(
  userId: string,
  input: { pageId: string; name: string; layout?: GroupLayout; links?: { url: string; title?: string | null }[] },
) {
  return write(userId, async (tx) => {
    await assertPage(tx, userId, input.pageId);
    const [{ value }] = await tx
      .select({ value: max(groups.position) })
      .from(groups)
      .where(and(eq(groups.userId, userId), eq(groups.pageId, input.pageId)));
    const id = crypto.randomUUID();
    await tx.insert(groups).values({
      id,
      userId,
      pageId: input.pageId,
      name: input.name,
      layout: input.layout ?? "list",
      position: (value ?? -1) + 1,
    });

    const links: ImportLink[] = [];
    for (const link of input.links ?? []) {
      const url = normalizeUrl(link.url);
      if (url) links.push({ url, title: link.title?.trim().slice(0, 512) || null });
    }
    await enqueue(tx, userId, await insertLinks(tx, userId, id, links, "user"));
    return { id, added: links.length, skipped: (input.links?.length ?? 0) - links.length };
  });
}

/** Inserts links at the end of a group and returns their ids. */
async function insertLinks(tx: Tx, userId: string, groupId: string, links: ImportLink[], source: "user" | "import") {
  const ids = links.map(() => crypto.randomUUID());
  // Chunked so one statement never gets too large.
  for (let start = 0; start < links.length; start += 500) {
    await tx.insert(items).values(
      links.slice(start, start + 500).map((link, i) => ({
        id: ids[start + i],
        userId,
        groupId,
        type: "link" as const,
        url: link.url,
        title: link.title,
        position: start + i,
        source,
        status: "active" as const,
      })),
    );
  }
  return ids;
}

// ---------- import (SP-9) ----------

/**
 * Imports a bookmark tree (from an HTML bookmark file or the Chrome extension)
 * as new pages after the existing ones. Existing pages are never changed.
 * Everything is written in one transaction, so a failed import leaves nothing behind.
 */
export async function importBookmarks(userId: string, tree: BookmarkNode[]) {
  let plan: ReturnType<typeof planImport>;
  try {
    plan = planImport(tree);
  } catch (err) {
    throw new InvalidInputError((err as Error).message);
  }
  if (plan.linkCount === 0) throw new InvalidInputError("No links found to import.");

  return write(userId, async (tx) => {
    const [{ value }] = await tx.select({ value: max(pages.position) }).from(pages).where(eq(pages.userId, userId));
    let pagePosition = (value ?? -1) + 1;
    const pageIds: string[] = [];

    for (const page of plan.pages) {
      const pageId = crypto.randomUUID();
      pageIds.push(pageId);
      await tx.insert(pages).values({ id: pageId, userId, name: page.name, position: pagePosition++ });
      for (const [position, group] of page.groups.entries()) {
        const groupId = crypto.randomUUID();
        await tx.insert(groups).values({ id: groupId, userId, pageId, name: group.name, position, layout: "list" });
        await enqueue(tx, userId, await insertLinks(tx, userId, groupId, group.links, "import"));
      }
    }
    return {
      pageIds,
      pages: plan.pages.length,
      groups: plan.groupCount,
      links: plan.linkCount,
      skipped: plan.skipped,
    };
  });
}

export function updateGroup(userId: string, groupId: string, input: { name?: string; layout?: GroupLayout }) {
  return write(userId, async (tx) => {
    const result = await tx.update(groups).set(input).where(and(eq(groups.id, groupId), eq(groups.userId, userId)));
    if (affected(result) === 0) await assertGroup(tx, userId, groupId);
    return {};
  });
}

export function deleteGroup(userId: string, groupId: string) {
  return write(userId, async (tx) => {
    await assertGroup(tx, userId, groupId);
    await tx.delete(groups).where(and(eq(groups.id, groupId), eq(groups.userId, userId)));
    return {};
  });
}

/** Sets the order of groups on a page. Can also move groups onto this page. */
export function reorderGroups(userId: string, pageId: string, ids: string[]) {
  return write(userId, async (tx) => {
    await assertPage(tx, userId, pageId);
    const owned = await tx
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.userId, userId), inArray(groups.id, ids)));
    if (owned.length !== new Set(ids).size) throw new NotFoundError("Group");
    for (const [position, id] of ids.entries()) {
      await tx.update(groups).set({ position, pageId }).where(and(eq(groups.id, id), eq(groups.userId, userId)));
    }
    return {};
  });
}

// ---------- items (links and notes) ----------

type ItemInput = {
  groupId: string;
  type: "link" | "note";
  url?: string | null;
  title?: string | null;
  noteBody?: string | null;
};

function cleanItemFields(input: { type?: "link" | "note"; url?: string | null; title?: string | null; noteBody?: string | null }) {
  const out: { url?: string | null; title?: string | null; noteBody?: string | null } = {};
  if (input.url !== undefined) {
    if (input.url === null || input.url === "") {
      out.url = null;
    } else {
      const url = normalizeUrl(input.url);
      if (!url) throw new InvalidInputError("That doesn't look like a valid web address.");
      out.url = url;
    }
  }
  if (input.title !== undefined) out.title = input.title?.trim() || null;
  if (input.noteBody !== undefined) out.noteBody = input.noteBody === null ? null : sanitizeNoteHtml(input.noteBody);
  return out;
}

export function createItem(userId: string, input: ItemInput) {
  return write(userId, async (tx) => {
    await assertGroup(tx, userId, input.groupId);
    const fields = cleanItemFields(input);
    if (input.type === "link" && !fields.url) throw new InvalidInputError("A link needs a web address.");

    const [{ value }] = await tx
      .select({ value: max(items.position) })
      .from(items)
      .where(and(eq(items.userId, userId), eq(items.groupId, input.groupId)));
    const id = crypto.randomUUID();
    await tx.insert(items).values({
      id,
      userId,
      groupId: input.groupId,
      type: input.type,
      ...fields,
      position: (value ?? -1) + 1,
      source: "user",
      status: "active",
    });
    await enqueue(tx, userId, [id]);
    const [row] = await tx.select().from(items).where(eq(items.id, id));
    const item: ItemDTO = {
      id,
      type: row.type,
      url: row.url,
      title: row.title,
      noteBody: row.noteBody,
      position: row.position,
    };
    return { item };
  });
}

export function updateItem(
  userId: string,
  itemId: string,
  input: { url?: string | null; title?: string | null; noteBody?: string | null },
) {
  return write(userId, async (tx) => {
    const [existing] = await tx
      .select({ type: items.type })
      .from(items)
      .where(and(eq(items.id, itemId), eq(items.userId, userId)));
    if (!existing) throw new NotFoundError("Item");
    const fields = cleanItemFields(input);
    if (existing.type === "link" && fields.url === null) throw new InvalidInputError("A link needs a web address.");
    if (Object.keys(fields).length > 0) {
      await tx.update(items).set(fields).where(and(eq(items.id, itemId), eq(items.userId, userId)));
    }
    // A new address or new note text means fetching and summarizing again.
    if (fields.url !== undefined || fields.noteBody !== undefined) await enqueue(tx, userId, [itemId]);
    const [row] = await tx.select().from(items).where(eq(items.id, itemId));
    return { item: { id: row.id, type: row.type, url: row.url, title: row.title, noteBody: row.noteBody, position: row.position } };
  });
}

/** Moves an item to the trash; restoreItem undoes it. */
export function deleteItem(userId: string, itemId: string) {
  return setItemStatus(userId, itemId, "trashed");
}

export function restoreItem(userId: string, itemId: string) {
  return setItemStatus(userId, itemId, "active");
}

function setItemStatus(userId: string, itemId: string, status: "active" | "trashed") {
  return write(userId, async (tx) => {
    const [existing] = await tx
      .select({ id: items.id })
      .from(items)
      .where(and(eq(items.id, itemId), eq(items.userId, userId)));
    if (!existing) throw new NotFoundError("Item");
    await tx.update(items).set({ status }).where(and(eq(items.id, itemId), eq(items.userId, userId)));
    return {};
  });
}

/** Sets the order of items in a group, moving any listed item into that group. */
export function reorderItems(userId: string, groupId: string, ids: string[]) {
  return write(userId, async (tx) => {
    await assertGroup(tx, userId, groupId);
    if (ids.length > 0) {
      const owned = await tx
        .select({ id: items.id })
        .from(items)
        .where(and(eq(items.userId, userId), inArray(items.id, ids)));
      if (owned.length !== new Set(ids).size) throw new NotFoundError("Item");
    }
    for (const [position, id] of ids.entries()) {
      await tx.update(items).set({ position, groupId }).where(and(eq(items.id, id), eq(items.userId, userId)));
    }
    return {};
  });
}
