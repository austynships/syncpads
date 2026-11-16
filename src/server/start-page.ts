/**
 * Start page data access (Phase 2). Every function takes the signed-in
 * user's id and only ever touches that user's rows.
 * Every write bumps user_settings.revision in the same transaction (SP-6 sync).
 */
import { and, asc, eq, inArray, isNotNull, max, or, sql } from "drizzle-orm";
import { db, type Db } from "@/db";
import { activityLog, agents, groups, itemEnrichment, items, pageMembers, pages, userSettings, users, widgets, type Wallpaper } from "@/db/schema";
import type { AnyWidgetConfig, WidgetDTO } from "@/lib/widgets";
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
import { FILE_FORMAT, FILE_VERSION, countFile, type FilePage, type SyncPadsFile } from "@/lib/syncpads-file";
import { getTemplate } from "@/lib/page-templates";
import { aiAvailability } from "./enrichment/ai";
import { enqueue, requeueForAi } from "./enrichment/queue";
import { notifyLostAccess, notifyPageActivity } from "./notifications";
import { assertCanAddLinks, assertCanAddPages } from "./plans";

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

// ---------- shared pages: who may edit what ----------

/**
 * A page's rows (and its groups and items) belong to its owner. Editors who
 * joined through an edit link (page_members) can change them too. Each write
 * resolves the owner first, so plan limits and smart features follow the owner.
 */
export type Access = { ownerId: string; pageId: string; role: "owner" | "editor" };

/** The actor's access to a page, or NotFound (same answer whether it doesn't exist or isn't theirs). */
export async function pageAccess(tx: Tx | Db, actorId: string, pageId: string, what = "Page"): Promise<Access> {
  const [row] = await tx
    .select({ ownerId: pages.userId, member: pageMembers.userId })
    .from(pages)
    .leftJoin(pageMembers, and(eq(pageMembers.pageId, pages.id), eq(pageMembers.userId, actorId)))
    .where(and(eq(pages.id, pageId), or(eq(pages.userId, actorId), isNotNull(pageMembers.userId))));
  if (!row) throw new NotFoundError(what);
  return { ownerId: row.ownerId, pageId, role: row.ownerId === actorId ? "owner" : "editor" };
}

async function groupAccess(tx: Tx, actorId: string, groupId: string) {
  const [g] = await tx.select({ pageId: groups.pageId }).from(groups).where(eq(groups.id, groupId));
  if (!g) throw new NotFoundError("Group");
  return pageAccess(tx, actorId, g.pageId, "Group");
}

async function itemAccess(tx: Tx, actorId: string, itemId: string) {
  const [it] = await tx
    .select({ type: items.type, status: items.status, pageId: groups.pageId })
    .from(items)
    .innerJoin(groups, eq(groups.id, items.groupId))
    .where(eq(items.id, itemId));
  if (!it) throw new NotFoundError("Item");
  return { ...(await pageAccess(tx, actorId, it.pageId, "Item")), type: it.type, status: it.status };
}

/** Everyone who sees a page: its owner and its editors. */
async function pageAudience(tx: Tx, pageId: string): Promise<string[]> {
  const [owner] = await tx.select({ id: pages.userId }).from(pages).where(eq(pages.id, pageId));
  const members = await tx.select({ id: pageMembers.userId }).from(pageMembers).where(eq(pageMembers.pageId, pageId));
  return [...(owner ? [owner.id] : []), ...members.map((m) => m.id)];
}

/** Lets a write mark pages it changed, so everyone who sees them refreshes. */
export type Touch = (pageId: string) => Promise<void>;

/**
 * Runs a write in a transaction and bumps the user's revision, so other tabs
 * and devices pick it up. Pages passed to `touch` also bump the revision of
 * everyone else who sees them (the owner and editors of a shared page).
 */
export async function write<T extends object>(userId: string, fn: (tx: Tx, touch: Touch) => Promise<T>) {
  await ensureUserSetup(userId);
  return db.transaction(async (tx) => {
    const others = new Set<string>();
    const touch: Touch = async (pageId) => {
      for (const id of await pageAudience(tx, pageId)) if (id !== userId) others.add(id);
    };
    const result = await fn(tx, touch);
    for (const id of others) await bumpRevision(tx, id);
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
  const ownPages = await db.select().from(pages).where(eq(pages.userId, userId)).orderBy(asc(pages.position));
  // Pages other people shared with this user through an edit link.
  const joined = await db
    .select({ page: pages, position: pageMembers.position, ownerName: users.name })
    .from(pageMembers)
    .innerJoin(pages, eq(pages.id, pageMembers.pageId))
    .innerJoin(users, eq(users.id, pages.userId))
    .where(eq(pageMembers.userId, userId));
  const joinedIds = joined.map((j) => j.page.id);
  const ownIds = ownPages.map((p) => p.id);
  // Editors per own shared page, for the owner's share dialog.
  const editorCounts = new Map(
    (
      await db
        .select({ pageId: pageMembers.pageId, n: sql<number>`COUNT(*)` })
        .from(pageMembers)
        .innerJoin(pages, eq(pages.id, pageMembers.pageId))
        .where(eq(pages.userId, userId))
        .groupBy(pageMembers.pageId)
    ).map((r) => [r.pageId, Number(r.n)]),
  );

  const allPageIds = [...ownIds, ...joinedIds];
  const groupRows = allPageIds.length
    ? await db.select().from(groups).where(inArray(groups.pageId, allPageIds)).orderBy(asc(groups.position))
    : [];
  const widgetRows = allPageIds.length
    ? await db.select().from(widgets).where(inArray(widgets.pageId, allPageIds)).orderBy(asc(widgets.position))
    : [];
  const widgetsByPage = new Map<string, WidgetDTO[]>();
  for (const w of widgetRows) {
    const list = widgetsByPage.get(w.pageId) ?? [];
    list.push({ id: w.id, type: w.type, config: (w.config ?? {}) as AnyWidgetConfig, position: w.position });
    widgetsByPage.set(w.pageId, list);
  }
  const itemRows = groupRows.length
    ? await db
        .select()
        .from(items)
        .where(and(inArray(items.groupId, groupRows.map((g) => g.id)), eq(items.status, "active")))
        .orderBy(asc(items.position))
    : [];
  const agentIds = [...new Set(itemRows.map((i) => i.createdByAgentId).filter((id): id is string => Boolean(id)))];
  const agentNames = new Map(
    agentIds.length
      ? (await db.select({ id: agents.id, name: agents.name }).from(agents).where(inArray(agents.id, agentIds))).map((a) => [a.id, a.name])
      : [],
  );
  const enrichmentRows = itemRows.length
    ? await db
        .select({ itemId: itemEnrichment.itemId, summary: itemEnrichment.summary, tags: itemEnrichment.tags })
        .from(itemEnrichment)
        .where(inArray(itemEnrichment.itemId, itemRows.map((i) => i.id)))
    : [];
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
      savedBy: i.createdByAgentId ? (agentNames.get(i.createdByAgentId) ?? "An agent") : null,
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
    pages: [
      ...ownPages.map(
        (p): PageDTO => ({
          id: p.id,
          name: p.name,
          layout: (p.layout as PageLayout) ?? "auto",
          position: p.position,
          hiddenFromAgents: p.hiddenFromAgents,
          access: "owner",
          ownerName: null,
          share: p.shareToken
            ? { token: p.shareToken, role: p.shareRole, includeNotes: p.shareNotes, copies: p.shareCopies, editors: editorCounts.get(p.id) ?? 0 }
            : null,
          groups: groupsByPage.get(p.id) ?? [],
          widgets: widgetsByPage.get(p.id) ?? [],
        }),
      ),
      ...joined.map(
        ({ page: p, position, ownerName }): PageDTO => ({
          id: p.id,
          name: p.name,
          layout: (p.layout as PageLayout) ?? "auto",
          position,
          hiddenFromAgents: p.hiddenFromAgents,
          access: "editor",
          ownerName: ownerName.trim().split(/\s+/)[0] || "Someone",
          // Editors can pass the edit link on, but only the owner changes sharing.
          share: p.shareToken ? { token: p.shareToken, role: p.shareRole, includeNotes: p.shareNotes, copies: p.shareCopies, editors: 0 } : null,
          groups: groupsByPage.get(p.id) ?? [],
          widgets: widgetsByPage.get(p.id) ?? [],
        }),
      ),
    ].sort((a, b) => a.position - b.position),
  };
}

// ---------- Agent Inbox (SP-16) ----------

async function getInbox(userId: string): Promise<InboxItemDTO[]> {
  const rows = await db
    .select({
      id: items.id,
      type: items.type,
      url: items.url,
      title: items.title,
      noteBody: items.noteBody,
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
      type: r.type,
      url: r.url,
      title: r.title,
      noteBody: r.noteBody,
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

export function updateSettings(
  userId: string,
  input: { theme?: Theme; wallpaper?: Wallpaper; aiEnabled?: boolean; contextProfile?: string | null },
) {
  return write(userId, async (tx) => {
    await tx.update(userSettings).set(input).where(eq(userSettings.userId, userId));
    // Turning smart features on: summarize and embed what's already saved.
    if (input.aiEnabled) await requeueForAi(tx, userId);
    return {};
  });
}

// ---------- pages ----------

/** The next tab position after the user's own pages and the pages shared with them. */
export async function nextPagePosition(tx: Tx | Db, userId: string) {
  const [{ own }] = await tx.select({ own: max(pages.position) }).from(pages).where(eq(pages.userId, userId));
  const [{ joined }] = await tx.select({ joined: max(pageMembers.position) }).from(pageMembers).where(eq(pageMembers.userId, userId));
  return Math.max(own ?? -1, joined ?? -1) + 1;
}

export function createPage(userId: string, input: { name: string }) {
  return write(userId, async (tx) => {
    await assertCanAddPages(userId, 1, tx);
    const value = (await nextPagePosition(tx, userId)) - 1;
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
  return write(userId, async (tx, touch) => {
    const access = await pageAccess(tx, userId, pageId);
    // Hiding a page from AI is the owner's privacy choice; editors can rename and change columns.
    if (access.role !== "owner" && input.hiddenFromAgents !== undefined) {
      throw new InvalidInputError("Only the page's owner can change that.");
    }
    await tx.update(pages).set(input).where(eq(pages.id, pageId));
    await touch(pageId);
    return {};
  });
}

export function deletePage(userId: string, pageId: string) {
  return write(userId, async (tx, touch) => {
    await assertPage(tx, userId, pageId); // only the owner deletes a page; editors leave it instead
    await touch(pageId); // before deleting, while its editors are still known
    const editors = await tx.select({ id: pageMembers.userId }).from(pageMembers).where(eq(pageMembers.pageId, pageId));
    await notifyLostAccess(tx, userId, pageId, editors.map((e) => e.id), "deleted");
    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(pages)
      .where(eq(pages.userId, userId));
    if (Number(count) <= 1) throw new InvalidInputError("You need at least one page.");
    await tx.delete(pages).where(and(eq(pages.id, pageId), eq(pages.userId, userId)));
    return {};
  });
}

/** Sets the user's tab order, across their own pages and pages shared with them. */
export function reorderPages(userId: string, ids: string[]) {
  return write(userId, async (tx) => {
    const owned = new Set(
      (await tx.select({ id: pages.id }).from(pages).where(and(eq(pages.userId, userId), inArray(pages.id, ids)))).map((r) => r.id),
    );
    const joined = new Set(
      (
        await tx
          .select({ id: pageMembers.pageId })
          .from(pageMembers)
          .where(and(eq(pageMembers.userId, userId), inArray(pageMembers.pageId, ids)))
      ).map((r) => r.id),
    );
    if (owned.size + joined.size !== new Set(ids).size) throw new NotFoundError("Page");
    for (const [position, id] of ids.entries()) {
      if (owned.has(id)) await tx.update(pages).set({ position }).where(and(eq(pages.id, id), eq(pages.userId, userId)));
      else await tx.update(pageMembers).set({ position }).where(and(eq(pageMembers.pageId, id), eq(pageMembers.userId, userId)));
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
  return write(userId, async (tx, touch) => {
    const { ownerId } = await pageAccess(tx, userId, input.pageId);
    const [{ value }] = await tx.select({ value: max(groups.position) }).from(groups).where(eq(groups.pageId, input.pageId));
    const id = crypto.randomUUID();
    await tx.insert(groups).values({
      id,
      userId: ownerId,
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
    await assertCanAddLinks(ownerId, links.length, tx);
    await enqueue(tx, ownerId, await insertLinks(tx, ownerId, id, links, "user"));
    await touch(input.pageId);
    if (links.length) await notifyPageActivity(tx, userId, input.pageId, { links: links.length });
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
    await assertCanAddPages(userId, plan.pages.length, tx);
    await assertCanAddLinks(userId, plan.linkCount, tx);
    let pagePosition = await nextPagePosition(tx, userId);
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

/**
 * Creates a page from a template (see page-templates.ts), named as the user
 * chose. Uses the import path, so plan limits apply and links get summaries.
 */
export async function createPageFromTemplate(userId: string, input: { name: string; template: string }) {
  const template = getTemplate(input.template);
  if (!template) throw new InvalidInputError("That template doesn't exist.");
  const result = await importSyncPadsFile(userId, {
    format: FILE_FORMAT,
    version: FILE_VERSION,
    pages: [{ ...template.page, name: input.name }],
  });
  return { id: result.pageIds[0], revision: result.revision };
}

// ---------- export and SyncPads-file import (SP-10) ----------

/**
 * Everything on the user's pages (or one page) as a SyncPads file: pages,
 * groups, links and notes in their order. Agent Inbox and trash aren't included.
 */
export async function exportPages(userId: string, pageId?: string): Promise<SyncPadsFile> {
  await ensureUserSetup(userId);
  const pageRows = await db
    .select({ id: pages.id, name: pages.name, layout: pages.layout, hiddenFromAgents: pages.hiddenFromAgents })
    .from(pages)
    .where(and(eq(pages.userId, userId), pageId ? eq(pages.id, pageId) : undefined))
    .orderBy(asc(pages.position));
  if (pageId && pageRows.length === 0) throw new NotFoundError("Page");
  const pageIds = pageRows.map((p) => p.id);

  const groupRows = await db
    .select({ id: groups.id, pageId: groups.pageId, name: groups.name, layout: groups.layout })
    .from(groups)
    .where(and(eq(groups.userId, userId), inArray(groups.pageId, pageIds)))
    .orderBy(asc(groups.position));
  const itemRows = groupRows.length
    ? await db
        .select({
          groupId: items.groupId,
          type: items.type,
          url: items.url,
          title: items.title,
          noteBody: items.noteBody,
          summary: itemEnrichment.summary,
          tags: itemEnrichment.tags,
        })
        .from(items)
        .leftJoin(itemEnrichment, eq(itemEnrichment.itemId, items.id))
        .where(and(eq(items.userId, userId), eq(items.status, "active"), inArray(items.groupId, groupRows.map((g) => g.id))))
        .orderBy(asc(items.position), asc(items.createdAt))
    : [];

  const itemsByGroup = new Map<string, FilePage["groups"][number]["items"]>();
  for (const it of itemRows) {
    const list = itemsByGroup.get(it.groupId) ?? [];
    if (it.type === "link" && it.url) {
      list.push({ type: "link", url: it.url, title: it.title, ...(it.summary ? { summary: it.summary } : {}), ...(it.tags?.length ? { tags: it.tags } : {}) });
    } else if (it.type === "note") {
      list.push({ type: "note", title: it.title, body: it.noteBody });
    }
    itemsByGroup.set(it.groupId, list);
  }

  return {
    format: FILE_FORMAT,
    version: FILE_VERSION,
    exportedAt: new Date().toISOString(),
    pages: pageRows.map((p) => ({
      name: p.name,
      layout: p.layout as FilePage["layout"],
      hiddenFromAgents: p.hiddenFromAgents,
      groups: groupRows
        .filter((g) => g.pageId === p.id)
        .map((g) => ({ name: g.name, layout: g.layout, items: itemsByGroup.get(g.id) ?? [] })),
    })),
  };
}

type TransferItem = { type: "link" | "note"; url: string | null; title: string | null; noteBody: string | null };

/**
 * Imports a SyncPads file as new pages after the existing ones, keeping page
 * and group layouts, notes and "hidden from agents". Existing pages are never
 * changed, and it's one transaction, so a failed import leaves nothing behind.
 * Links get fresh summaries and tags (smart features permitting).
 */
export async function importSyncPadsFile(userId: string, file: SyncPadsFile) {
  const counts = countFile(file);
  if (counts.links + counts.notes === 0) throw new InvalidInputError("That file has no links or notes to import.");

  return write(userId, async (tx) => {
    await assertCanAddPages(userId, file.pages.length, tx);
    let skipped = 0;
    const prepared = file.pages.map((page) => ({
      ...page,
      groups: page.groups.map((group) => ({
        ...group,
        items: group.items.flatMap((item): TransferItem[] => {
          if (item.type === "link") {
            const url = normalizeUrl(item.url);
            if (!url) {
              skipped++;
              return [];
            }
            return [{ type: "link" as const, url, title: item.title?.trim().slice(0, 512) || null, noteBody: null }];
          }
          const body = item.body ? sanitizeNoteHtml(item.body) : null;
          return [{ type: "note" as const, url: null, title: item.title?.trim().slice(0, 512) || null, noteBody: body }];
        }),
      })),
    }));
    const links = prepared.reduce((n, p) => n + p.groups.reduce((m, g) => m + g.items.filter((i) => i.type === "link").length, 0), 0);
    await assertCanAddLinks(userId, links, tx);

    let pagePosition = await nextPagePosition(tx, userId);
    const pageIds: string[] = [];
    const linkIds: string[] = [];

    for (const page of prepared) {
      const pageId = crypto.randomUUID();
      pageIds.push(pageId);
      await tx.insert(pages).values({
        id: pageId,
        userId,
        name: page.name,
        position: pagePosition++,
        layout: page.layout ?? "auto",
        hiddenFromAgents: page.hiddenFromAgents ?? false,
      });
      for (const [position, group] of page.groups.entries()) {
        const groupId = crypto.randomUUID();
        await tx.insert(groups).values({ id: groupId, userId, pageId, name: group.name, position, layout: group.layout ?? "list" });
        for (let start = 0; start < group.items.length; start += 500) {
          const rows = group.items.slice(start, start + 500).map((item, i) => {
            const id = crypto.randomUUID();
            if (item.type === "link") linkIds.push(id);
            return { id, userId, groupId, ...item, position: start + i, source: "import" as const, status: "active" as const };
          });
          await tx.insert(items).values(rows);
        }
      }
    }
    await enqueue(tx, userId, linkIds);
    return { pageIds, pages: prepared.length, groups: counts.groups, links, notes: counts.notes, skipped };
  });
}

export function updateGroup(userId: string, groupId: string, input: { name?: string; layout?: GroupLayout }) {
  return write(userId, async (tx, touch) => {
    const { pageId } = await groupAccess(tx, userId, groupId);
    await tx.update(groups).set(input).where(eq(groups.id, groupId));
    await touch(pageId);
    return {};
  });
}

export function deleteGroup(userId: string, groupId: string) {
  return write(userId, async (tx, touch) => {
    const { pageId } = await groupAccess(tx, userId, groupId);
    await tx.delete(groups).where(eq(groups.id, groupId));
    await touch(pageId);
    return {};
  });
}

/** Sets the order of groups on a page. Can also move groups onto this page. */
export function reorderGroups(userId: string, pageId: string, ids: string[]) {
  return write(userId, async (tx, touch) => {
    const target = await pageAccess(tx, userId, pageId);
    const rows = ids.length ? await tx.select({ id: groups.id, pageId: groups.pageId }).from(groups).where(inArray(groups.id, ids)) : [];
    if (rows.length !== new Set(ids).size) throw new NotFoundError("Group");
    // Groups can move between pages of the same owner that this user can edit,
    // never into or out of someone else's page.
    const sources = new Set(rows.map((r) => r.pageId));
    for (const source of sources) {
      const access = await pageAccess(tx, userId, source, "Group");
      if (access.ownerId !== target.ownerId) throw new InvalidInputError("Groups can't move between your pages and a shared page.");
    }
    for (const [position, id] of ids.entries()) {
      await tx.update(groups).set({ position, pageId }).where(eq(groups.id, id));
    }
    for (const page of new Set([pageId, ...sources])) await touch(page);
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
  return write(userId, async (tx, touch) => {
    const { ownerId, pageId } = await groupAccess(tx, userId, input.groupId);
    if (input.type === "link") await assertCanAddLinks(ownerId, 1, tx);
    const fields = cleanItemFields(input);
    if (input.type === "link" && !fields.url) throw new InvalidInputError("A link needs a web address.");

    const [{ value }] = await tx
      .select({ value: max(items.position) })
      .from(items)
      .where(eq(items.groupId, input.groupId));
    const id = crypto.randomUUID();
    await tx.insert(items).values({
      id,
      userId: ownerId,
      groupId: input.groupId,
      type: input.type,
      ...fields,
      position: (value ?? -1) + 1,
      source: "user",
      status: "active",
    });
    await enqueue(tx, ownerId, [id]);
    await touch(pageId);
    await notifyPageActivity(tx, userId, pageId, input.type === "link" ? { links: 1 } : { notes: 1 });
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
  return write(userId, async (tx, touch) => {
    const existing = await itemAccess(tx, userId, itemId);
    const fields = cleanItemFields(input);
    if (existing.type === "link" && fields.url === null) throw new InvalidInputError("A link needs a web address.");
    if (Object.keys(fields).length > 0) {
      await tx.update(items).set(fields).where(eq(items.id, itemId));
    }
    // A new address or new note text means fetching and summarizing again.
    if (fields.url !== undefined || fields.noteBody !== undefined) await enqueue(tx, existing.ownerId, [itemId]);
    await touch(existing.pageId);
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
  return write(userId, async (tx, touch) => {
    const existing = await itemAccess(tx, userId, itemId);
    // Agent Inbox items are only approved or dismissed by their owner, through the inbox.
    if (existing.status === "inbox") throw new NotFoundError("Item");
    // Restoring a trashed link counts toward the (owner's) Free link limit again.
    if (status === "active" && existing.status === "trashed" && existing.type === "link") {
      await assertCanAddLinks(existing.ownerId, 1, tx);
    }
    await tx.update(items).set({ status }).where(eq(items.id, itemId));
    await touch(existing.pageId);
    return {};
  });
}

/** Sets the order of items in a group, moving any listed item into that group. */
export function reorderItems(userId: string, groupId: string, ids: string[]) {
  return write(userId, async (tx, touch) => {
    const target = await groupAccess(tx, userId, groupId);
    const sources = new Set<string>();
    if (ids.length > 0) {
      const rows = await tx
        .select({ id: items.id, pageId: groups.pageId })
        .from(items)
        .innerJoin(groups, eq(groups.id, items.groupId))
        .where(inArray(items.id, ids));
      if (rows.length !== new Set(ids).size) throw new NotFoundError("Item");
      for (const r of rows) sources.add(r.pageId);
      // Items move only between pages of the same owner that this user can edit.
      for (const source of sources) {
        const access = await pageAccess(tx, userId, source, "Item");
        if (access.ownerId !== target.ownerId) throw new InvalidInputError("Links can't move between your pages and a shared page.");
      }
    }
    for (const [position, id] of ids.entries()) {
      await tx.update(items).set({ position, groupId }).where(eq(items.id, id));
    }
    for (const page of new Set([target.pageId, ...sources])) await touch(page);
    return {};
  });
}
