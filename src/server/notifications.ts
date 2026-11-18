/**
 * Notifications: a bell in the app with things worth knowing about.
 *
 * Personal notifications (one row per person) come from events: someone
 * joined, left or changed a page you share, you were removed from a page, an
 * AI suggested something for your Agent Inbox. Bursts are combined: repeated
 * events of one kind, from the same person, on the same page, update one unread
 * row ("Eddie added 3 links and a note") instead of piling up.
 *
 * Announcements (from an admin, such as a new feature) are one row each, shown
 * to everyone in the audience who signed up before it was sent; reads are tracked
 * per person in announcement_reads.
 */
import { and, desc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import { db, type Db } from "@/db";
import { announcementReads, announcements, notifications, pageMembers, pages, users } from "@/db/schema";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Exec = Db | Tx;

export type NotificationType =
  | "announcement"
  | "page_joined"
  | "page_left"
  | "page_activity"
  | "page_removed"
  | "page_unshared"
  | "page_deleted"
  | "agent_suggestion"
  | "gallery"
  | "admin_message";

export type NotificationDTO = {
  /** "n_<id>" for personal notifications, "a_<id>" for announcements. */
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
};

const COMBINE_WINDOW_MS = 12 * 60 * 60 * 1000;
const LIST_LIMIT = 40;

const firstName = (name: string | null | undefined) => name?.trim().split(/\s+/)[0] || "Someone";
const quote = (s: string) => `“${s.length > 60 ? `${s.slice(0, 59)}…` : s}”`;
export const pageLink = (pageId: string) => `/app?page=${encodeURIComponent(pageId)}`;

/** "3 links and a note", "a link", "2 links, a note and a widget". */
export function describeCounts(meta: { links?: number; notes?: number; widgets?: number }) {
  const part = (n: number, one: string, many: string) => (n === 1 ? `a ${one}` : `${n} ${many}`);
  const parts = [
    ...(meta.links ? [part(meta.links, "link", "links")] : []),
    ...(meta.notes ? [part(meta.notes, "note", "notes")] : []),
    ...(meta.widgets ? [part(meta.widgets, "widget", "widgets")] : []),
  ];
  if (parts.length === 0) return "something";
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

async function nameOf(exec: Exec, userId: string) {
  const [row] = await exec.select({ name: users.name }).from(users).where(eq(users.id, userId));
  return firstName(row?.name);
}

async function pageName(exec: Exec, pageId: string) {
  const [row] = await exec.select({ name: pages.name }).from(pages).where(eq(pages.id, pageId));
  return row?.name ?? "a page";
}

/** Sends the same notification to several people. */
export async function notify(
  exec: Exec,
  input: { userIds: string[]; type: NotificationType; title: string; body?: string | null; link?: string | null; pageId?: string | null; actorId?: string | null },
) {
  const recipients = [...new Set(input.userIds)].filter((id) => id !== input.actorId);
  if (recipients.length === 0) return;
  await exec.insert(notifications).values(
    recipients.map((userId) => ({
      userId,
      type: input.type,
      title: input.title.slice(0, 255),
      body: input.body ?? null,
      link: input.link ?? null,
      pageId: input.pageId ?? null,
      actorId: input.actorId ?? null,
    })),
  );
}

/**
 * Adds to (or starts) a combined notification for each recipient: same type,
 * same page and same actor, still unread and recent.
 */
async function combine(
  exec: Exec,
  input: {
    userIds: string[];
    type: NotificationType;
    pageId: string | null;
    actorId: string | null;
    /** Matches combined rows when there's no actor (an AI's name, for example). */
    key?: string;
    add: Record<string, number>;
    title: (meta: Record<string, number>) => string;
    link: string | null;
  },
) {
  const since = new Date(Date.now() - COMBINE_WINDOW_MS);
  for (const userId of new Set(input.userIds)) {
    if (userId === input.actorId) continue;
    const [existing] = await exec
      .select({ id: notifications.id, meta: notifications.meta, count: notifications.count })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.type, input.type),
          isNull(notifications.readAt),
          gte(notifications.updatedAt, since),
          input.pageId ? eq(notifications.pageId, input.pageId) : isNull(notifications.pageId),
          input.actorId ? eq(notifications.actorId, input.actorId) : isNull(notifications.actorId),
          input.key ? eq(notifications.body, input.key) : sql`1 = 1`,
        ),
      )
      .orderBy(desc(notifications.updatedAt))
      .limit(1);
    if (existing) {
      const meta = { ...(existing.meta ?? {}) };
      for (const [k, n] of Object.entries(input.add)) meta[k] = (meta[k] ?? 0) + n;
      await exec
        .update(notifications)
        .set({ meta, count: existing.count + 1, title: input.title(meta).slice(0, 255), updatedAt: new Date() })
        .where(eq(notifications.id, existing.id));
    } else {
      await exec.insert(notifications).values({
        userId,
        type: input.type,
        title: input.title(input.add).slice(0, 255),
        body: input.key ?? null,
        link: input.link,
        pageId: input.pageId,
        actorId: input.actorId,
        meta: input.add,
      });
    }
  }
}

/** Everyone on a shared page (owner and editors). */
async function audience(exec: Exec, pageId: string) {
  const [owner] = await exec.select({ id: pages.userId }).from(pages).where(eq(pages.id, pageId));
  const members = await exec.select({ id: pageMembers.userId }).from(pageMembers).where(eq(pageMembers.pageId, pageId));
  return [...(owner ? [owner.id] : []), ...members.map((m) => m.id)];
}

// ---------- events ----------

/** Someone added links or notes to a page others share: tell the others. */
export async function notifyPageActivity(
  exec: Exec,
  actorId: string,
  pageId: string,
  add: { links?: number; notes?: number; widgets?: number },
) {
  const people = await audience(exec, pageId);
  if (people.length < 2) return; // not shared with anyone
  const [who, page] = await Promise.all([nameOf(exec, actorId), pageName(exec, pageId)]);
  await combine(exec, {
    userIds: people,
    type: "page_activity",
    pageId,
    actorId,
    add: { links: add.links ?? 0, notes: add.notes ?? 0, widgets: add.widgets ?? 0 },
    title: (meta) => `${who} added ${describeCounts(meta)} to ${quote(page)}`,
    link: pageLink(pageId),
  });
}

export async function notifyJoined(exec: Exec, actorId: string, pageId: string, ownerId: string) {
  const [who, page] = await Promise.all([nameOf(exec, actorId), pageName(exec, pageId)]);
  await notify(exec, { userIds: [ownerId], type: "page_joined", title: `${who} joined ${quote(page)} and can edit it`, link: pageLink(pageId), pageId, actorId });
}

export async function notifyLeft(exec: Exec, actorId: string, pageId: string, ownerId: string) {
  const [who, page] = await Promise.all([nameOf(exec, actorId), pageName(exec, pageId)]);
  await notify(exec, { userIds: [ownerId], type: "page_left", title: `${who} left ${quote(page)}`, link: pageLink(pageId), pageId, actorId });
}

/** Editors lost a page: removed by the owner, sharing turned off or set to view only, or the page was deleted. */
export async function notifyLostAccess(
  exec: Exec,
  ownerId: string,
  pageId: string,
  editorIds: string[],
  why: "removed" | "unshared" | "view_only" | "deleted",
) {
  if (editorIds.length === 0) return;
  const [who, page] = await Promise.all([nameOf(exec, ownerId), pageName(exec, pageId)]);
  const title = {
    removed: `${who} removed you from ${quote(page)}`,
    unshared: `${who} stopped sharing ${quote(page)}`,
    view_only: `${who} made ${quote(page)} view only`,
    deleted: `${who} deleted ${quote(page)}`,
  }[why];
  await notify(exec, {
    userIds: editorIds,
    type: why === "deleted" ? "page_deleted" : why === "removed" ? "page_removed" : "page_unshared",
    title,
    body: why === "deleted" ? null : "It's no longer in your SyncPads.",
    // The page is gone for them; nothing to open. (pageId would dangle after a delete.)
    pageId: why === "deleted" ? null : pageId,
    actorId: ownerId,
  });
}

/** An AI put something in the user's Agent Inbox. */
export async function notifyAgentSuggestion(exec: Exec, userId: string, agentName: string, add: { links?: number; notes?: number }) {
  await combine(exec, {
    userIds: [userId],
    type: "agent_suggestion",
    pageId: null,
    actorId: null,
    key: agentName.slice(0, 100),
    add: { links: add.links ?? 0, notes: add.notes ?? 0 },
    title: (meta) => `${agentName} suggested ${describeCounts(meta)} for your Agent Inbox`,
    link: "/app?inbox=1",
  });
}

// ---------- reading ----------

/** Announcements this person should see: sent after they signed up, to their plan's audience. */
async function eligibleAnnouncements(userId: string) {
  const [u] = await db.select({ createdAt: users.createdAt, plan: users.plan }).from(users).where(eq(users.id, userId));
  if (!u) return null;
  return and(gte(announcements.createdAt, u.createdAt), or(eq(announcements.audience, "all"), eq(announcements.audience, u.plan)));
}

export async function listNotifications(userId: string): Promise<{ items: NotificationDTO[]; unread: number }> {
  const where = await eligibleAnnouncements(userId);
  const [personal, ann, unread] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.updatedAt))
      .limit(LIST_LIMIT),
    where
      ? db
          .select({ a: announcements, readAt: announcementReads.readAt })
          .from(announcements)
          .leftJoin(announcementReads, and(eq(announcementReads.announcementId, announcements.id), eq(announcementReads.userId, userId)))
          .where(where)
          .orderBy(desc(announcements.createdAt))
          .limit(10)
      : Promise.resolve([]),
    unreadCount(userId),
  ]);
  const items: NotificationDTO[] = [
    ...personal.map((n) => ({
      id: `n_${n.id}`,
      type: n.type as NotificationType,
      title: n.title,
      body: n.type === "agent_suggestion" ? null : n.body, // body is the combine key for AI suggestions
      link: n.link,
      read: n.readAt !== null,
      createdAt: n.updatedAt.toISOString(),
    })),
    ...ann.map(({ a, readAt }) => ({
      id: `a_${a.id}`,
      type: "announcement" as const,
      title: a.title,
      body: a.body,
      link: a.link,
      read: readAt !== null,
      createdAt: a.createdAt.toISOString(),
    })),
  ].sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  return { items: items.slice(0, LIST_LIMIT), unread };
}

export async function unreadCount(userId: string) {
  const where = await eligibleAnnouncements(userId);
  const [[personal], [ann]] = await Promise.all([
    db
      .select({ n: sql<number>`COUNT(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
    where
      ? db
          .select({ n: sql<number>`COUNT(*)` })
          .from(announcements)
          .leftJoin(announcementReads, and(eq(announcementReads.announcementId, announcements.id), eq(announcementReads.userId, userId)))
          .where(and(where, isNull(announcementReads.userId)))
      : Promise.resolve([{ n: 0 }]),
  ]);
  return Number(personal?.n ?? 0) + Number(ann?.n ?? 0);
}

/** Marks some notifications (by id) or all of them as read. */
export async function markRead(userId: string, ids: string[] | "all") {
  const now = new Date();
  if (ids === "all") {
    await db.update(notifications).set({ readAt: now }).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    const where = await eligibleAnnouncements(userId);
    if (where) {
      const unreadAnn = await db
        .select({ id: announcements.id })
        .from(announcements)
        .leftJoin(announcementReads, and(eq(announcementReads.announcementId, announcements.id), eq(announcementReads.userId, userId)))
        .where(and(where, isNull(announcementReads.userId)));
      if (unreadAnn.length) await db.insert(announcementReads).ignore().values(unreadAnn.map((a) => ({ announcementId: a.id, userId })));
    }
    return { unread: 0 };
  }
  const personal = ids.filter((i) => i.startsWith("n_")).map((i) => i.slice(2));
  const ann = ids.filter((i) => i.startsWith("a_")).map((i) => i.slice(2));
  if (personal.length) {
    await db
      .update(notifications)
      .set({ readAt: now })
      .where(and(eq(notifications.userId, userId), inArray(notifications.id, personal), isNull(notifications.readAt)));
  }
  if (ann.length) {
    const exists = await db.select({ id: announcements.id }).from(announcements).where(inArray(announcements.id, ann));
    if (exists.length) await db.insert(announcementReads).ignore().values(exists.map((a) => ({ announcementId: a.id, userId })));
  }
  return { unread: await unreadCount(userId) };
}

// ---------- announcements (admin) ----------

export type Audience = "all" | "free" | "pro";

// ---------- direct messages (admin to specific people) ----------

/** Splits a pasted list of emails (commas, spaces or new lines). */
export function parseEmails(text: string) {
  return [...new Set(text.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)))];
}

/**
 * An admin sends a notification to specific people by email. Returns how many
 * got it and which addresses don't belong to a SyncPads account.
 */
export async function sendDirectMessage(
  adminId: string,
  input: { emails: string[]; title: string; body?: string | null; link?: string | null },
) {
  const emails = [...new Set(input.emails.map((e) => e.trim().toLowerCase()))].slice(0, 500);
  if (emails.length === 0) return { sent: 0, notFound: [] as string[] };
  const rows = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(sql`LOWER(${users.email}) IN (${sql.join(emails.map((e) => sql`${e}`), sql`, `)})`);
  const found = new Set(rows.map((r) => r.email.toLowerCase()));
  if (rows.length) {
    await db.insert(notifications).values(
      rows.map((r) => ({
        userId: r.id,
        type: "admin_message",
        title: input.title.trim().slice(0, 255),
        body: input.body?.trim() || null,
        link: input.link?.trim() || null,
        actorId: adminId,
      })),
    );
  }
  return { sent: rows.length, notFound: emails.filter((e) => !found.has(e)) };
}

/** Recent direct messages, one row per send, with how many people got and read it. */
export async function listDirectMessages() {
  const [rows] = await db.execute(sql`
    SELECT n.title, n.body, n.link, MIN(n.created_at) AS sentAt, COUNT(*) AS recipients, SUM(n.read_at IS NOT NULL) AS readCount,
           GROUP_CONCAT(u.email ORDER BY u.email SEPARATOR ', ') AS emails
    FROM notifications n JOIN users u ON u.id = n.user_id
    WHERE n.type = 'admin_message'
    GROUP BY n.actor_id, n.title, n.body, n.link, DATE_FORMAT(n.created_at, '%Y-%m-%d %H:%i:%s')
    ORDER BY sentAt DESC
    LIMIT 50
  `);
  return (rows as unknown as { title: string; body: string | null; link: string | null; sentAt: Date; recipients: number; readCount: number; emails: string }[]).map((r) => ({
    ...r,
    sentAt: new Date(r.sentAt),
    recipients: Number(r.recipients),
    readCount: Number(r.readCount),
  }));
}

export async function createAnnouncement(adminId: string, input: { title: string; body?: string | null; link?: string | null; audience: Audience }) {
  const id = crypto.randomUUID();
  await db.insert(announcements).values({
    id,
    title: input.title.trim().slice(0, 120),
    body: input.body?.trim() || null,
    link: input.link?.trim() || null,
    audience: input.audience,
    createdBy: adminId,
  });
  return { id };
}

/** Retracts an announcement: it disappears from everyone's notifications. */
export async function deleteAnnouncement(id: string) {
  await db.delete(announcements).where(eq(announcements.id, id));
  return {};
}

/** Sent announcements with how many people they reached and how many read them. */
export async function listAnnouncements() {
  const rows = await db
    .select({
      id: announcements.id,
      title: announcements.title,
      body: announcements.body,
      link: announcements.link,
      audience: announcements.audience,
      createdAt: announcements.createdAt,
      reads: sql<number>`(SELECT COUNT(*) FROM announcement_reads r WHERE r.announcement_id = announcements.id)`,
      reach: sql<number>`(SELECT COUNT(*) FROM users u WHERE u.created_at <= announcements.created_at AND (announcements.audience = 'all' OR u.plan = announcements.audience))`,
    })
    .from(announcements)
    .orderBy(desc(announcements.createdAt))
    .limit(100);
  return rows.map((r) => ({ ...r, reads: Number(r.reads), reach: Number(r.reach) }));
}

/** How many people an announcement would reach right now. */
export async function audienceSize(audience: Audience) {
  const [row] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(users)
    .where(audience === "all" ? sql`1 = 1` : eq(users.plan, audience));
  return Number(row?.n ?? 0);
}

