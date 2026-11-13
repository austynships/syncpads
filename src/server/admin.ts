/**
 * Admin dashboard data. Admins are listed by email in ADMIN_EMAILS (comma
 * separated) in the server's .env, and must have verified their email.
 * Everything here is read-only. One function per dashboard page, so each page
 * only runs its own queries.
 */
import { and, desc, eq, gte, isNotNull, isNull, like, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, agents, items, pages, sessions, subscriptions, userSettings, users } from "@/db/schema";
import { billingAvailable, stripe } from "./billing";
import { EMBEDDING_MODEL, SUMMARY_MODEL, aiAvailability } from "./enrichment/ai";
import { PLAN_LIMITS, PRICES } from "./plans";

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdmin(user: { email: string; emailVerified?: boolean | null } | null | undefined) {
  if (!user?.email || !user.emailVerified) return false;
  return adminEmails().includes(user.email.toLowerCase());
}

/** The dashboard's time window: the last 24 hours, 7 days or 30 days. */
export const PERIODS = { day: 1, week: 7, month: 30 } as const;
export type Period = keyof typeof PERIODS;
export const isPeriod = (p: unknown): p is Period => typeof p === "string" && p in PERIODS;

const DAY = 86_400_000;
const since = (days: number) => new Date(Date.now() - days * DAY);
const fromFor = (period: Period) => since(PERIODS[period]);

const COUNT = sql<number>`COUNT(*)`;
async function count(query: Promise<{ n: number }[]>) {
  const [row] = await query;
  return Number(row?.n ?? 0);
}

// ---------- Shared pieces ----------

/** Revenue from Stripe since `from`, net of refunds, in US cents. Null when billing isn't set up or Stripe can't be reached. */
async function revenue(from: Date) {
  if (!billingAvailable()) return null;
  try {
    let total = 0;
    let charges = 0;
    for await (const charge of stripe().charges.list({ created: { gte: Math.floor(from.getTime() / 1000) }, limit: 100 })) {
      if (!charge.paid || charge.status !== "succeeded") continue;
      total += charge.amount - (charge.amount_refunded ?? 0);
      charges++;
    }
    const balance = await stripe().balance.retrieve();
    const usd = (list: { amount: number; currency: string }[]) =>
      list.filter((b) => b.currency === "usd").reduce((s, b) => s + b.amount, 0);
    return { total, charges, available: usd(balance.available), pending: usd(balance.pending), livemode: stripeLive() };
  } catch (err) {
    console.error("[admin] revenue unavailable:", (err as Error).message);
    return null;
  }
}

const stripeLive = () => !process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_");

/** Subscriptions mirrored from Stripe. Pro users without one (comped accounts) aren't counted. */
async function subscriptionSummary() {
  const subs = await db
    .select({ status: subscriptions.status, interval: subscriptions.interval, cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd })
    .from(subscriptions);
  const paying = subs.filter((s) => ["active", "trialing", "past_due"].includes(s.status));
  const mrr = paying.reduce((sum, s) => sum + (s.interval === "year" ? (PRICES.year * 100) / 12 : PRICES.month * 100), 0);
  return {
    paying: paying.length,
    monthly: paying.filter((s) => s.interval === "month").length,
    yearly: paying.filter((s) => s.interval === "year").length,
    cancelling: paying.filter((s) => s.cancelAtPeriodEnd).length,
    pastDue: paying.filter((s) => s.status === "past_due").length,
    mrrCents: Math.round(mrr),
  };
}

/**
 * Sign-ups over the period, one bar per hour for "day" and per day otherwise.
 * Keys match the bucket labels built in JS (UTC, like the database).
 */
async function signupSeries(period: Period) {
  const hourly = period === "day";
  const fmt = hourly ? "%Y-%m-%dT%H" : "%Y-%m-%d";
  const rows = await db
    .select({ key: sql<string>`DATE_FORMAT(${users.createdAt}, ${fmt})`, n: COUNT })
    .from(users)
    .where(gte(users.createdAt, fromFor(period)))
    .groupBy(sql`DATE_FORMAT(${users.createdAt}, ${fmt})`);
  const byKey = new Map(rows.map((r) => [String(r.key), Number(r.n)]));
  const buckets = hourly ? 24 : PERIODS[period];
  const step = hourly ? 3_600_000 : DAY;
  return Array.from({ length: buckets }, (_, i) => {
    const key = new Date(Date.now() - (buckets - 1 - i) * step).toISOString().slice(0, hourly ? 13 : 10);
    return { key, label: hourly ? `${key.slice(11, 13)}:00` : key.slice(5), n: byKey.get(key) ?? 0 };
  });
}

/** Users who signed in or used SyncPads (session refreshed) since `from`. */
const activeUsersSince = (from: Date) =>
  count(db.select({ n: sql<number>`COUNT(DISTINCT ${sessions.userId})` }).from(sessions).where(gte(sessions.updatedAt, from)));

const agentUsersActiveSince = (from: Date) =>
  count(
    db
      .select({ n: sql<number>`COUNT(DISTINCT ${agents.userId})` })
      .from(agents)
      .where(and(isNull(agents.revokedAt), gte(agents.lastUsedAt, from))),
  );

/** Requests made by agents (rows in the activity log that an agent made). */
const agentCallsSince = (from: Date) =>
  count(db.select({ n: COUNT }).from(activityLog).where(and(isNotNull(activityLog.agentId), gte(activityLog.createdAt, from))));

const activeItems = (type: "link" | "note", from?: Date) =>
  count(
    db
      .select({ n: COUNT })
      .from(items)
      .where(and(eq(items.type, type), eq(items.status, "active"), from ? gte(items.createdAt, from) : undefined)),
  );

// ---------- Overview ----------

export async function overviewStats(period: Period) {
  const from = fromFor(period);
  const [totalUsers, newUsers, activeUsers, links, linksAdded, totalPages, pagesAdded, agentUsersActive, agentCalls] =
    await Promise.all([
      count(db.select({ n: COUNT }).from(users)),
      count(db.select({ n: COUNT }).from(users).where(gte(users.createdAt, from))),
      activeUsersSince(from),
      activeItems("link"),
      activeItems("link", from),
      count(db.select({ n: COUNT }).from(pages)),
      count(db.select({ n: COUNT }).from(pages).where(gte(pages.createdAt, from))),
      agentUsersActiveSince(from),
      agentCallsSince(from),
    ]);
  return {
    period,
    generatedAt: new Date(),
    revenue: await revenue(from),
    subscriptions: await subscriptionSummary(),
    users: { total: totalUsers, new: newUsers, active: activeUsers },
    content: { links, linksAdded, pages: totalPages, pagesAdded },
    mcp: {
      calls: agentCalls,
      usersActive: agentUsersActive,
      // The PRD's gate metric: active users who used a connected agent ÷ active users, over the period.
      connectionRate: activeUsers ? Math.min(1, agentUsersActive / activeUsers) : null,
    },
    signups: await signupSeries(period),
  };
}

// ---------- Users ----------

export async function userStats(period: Period) {
  const from = fromFor(period);
  const [total, verified, pro, newUsers, activeUsers, smart, notes, notesAdded] = await Promise.all([
    count(db.select({ n: COUNT }).from(users)),
    count(db.select({ n: COUNT }).from(users).where(eq(users.emailVerified, true))),
    count(db.select({ n: COUNT }).from(users).where(eq(users.plan, "pro"))),
    count(db.select({ n: COUNT }).from(users).where(gte(users.createdAt, from))),
    activeUsersSince(from),
    count(db.select({ n: COUNT }).from(userSettings).where(eq(userSettings.aiEnabled, true))),
    activeItems("note"),
    activeItems("note", from),
  ]);
  return {
    period,
    total,
    verified,
    pro,
    free: total - pro,
    new: newUsers,
    active: activeUsers,
    smartFeatures: smart,
    notes,
    notesAdded,
    signups: await signupSeries(period),
  };
}

export const USERS_PAGE_SIZE = 50;

/** Users, newest first, optionally filtered by a name or email search. */
export async function listUsers({ q, page = 1 }: { q?: string; page?: number }) {
  const term = q?.trim();
  const where = term ? or(like(users.email, `%${term}%`), like(users.name, `%${term}%`)) : undefined;
  const [rows, total] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        plan: users.plan,
        verified: users.emailVerified,
        createdAt: users.createdAt,
        // Written out as users.id: an interpolated column would render unqualified and match the subquery's own id.
        links: sql<number>`(SELECT COUNT(*) FROM items i WHERE i.user_id = users.id AND i.type = 'link' AND i.status = 'active')`,
        pages: sql<number>`(SELECT COUNT(*) FROM pages p WHERE p.user_id = users.id)`,
        agents: sql<number>`(SELECT COUNT(*) FROM agents a WHERE a.user_id = users.id AND a.revoked_at IS NULL)`,
        lastActive: sql<Date | null>`(SELECT MAX(s.updated_at) FROM sessions s WHERE s.user_id = users.id)`,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(USERS_PAGE_SIZE)
      .offset((Math.max(1, page) - 1) * USERS_PAGE_SIZE),
    count(db.select({ n: COUNT }).from(users).where(where)),
  ]);
  return {
    total,
    users: rows.map((u) => ({
      ...u,
      links: Number(u.links),
      pages: Number(u.pages),
      agents: Number(u.agents),
      lastActive: u.lastActive ? new Date(u.lastActive) : null,
    })),
  };
}

// ---------- Agent Connects ----------

export async function agentStats(period: Period) {
  const from = fromFor(period);
  const [usersConnected, connected, activeUsers, usersActive, calls, writes, newConnections, inboxWaiting, approved, dismissed] =
    await Promise.all([
      count(db.select({ n: sql<number>`COUNT(DISTINCT ${agents.userId})` }).from(agents).where(isNull(agents.revokedAt))),
      count(db.select({ n: COUNT }).from(agents).where(isNull(agents.revokedAt))),
      activeUsersSince(from),
      agentUsersActiveSince(from),
      agentCallsSince(from),
      count(
        db
          .select({ n: COUNT })
          .from(activityLog)
          .where(and(isNotNull(activityLog.agentId), sql`${activityLog.action} IN ('add_link', 'save_context')`, gte(activityLog.createdAt, from))),
      ),
      count(db.select({ n: COUNT }).from(agents).where(gte(agents.createdAt, from))),
      count(db.select({ n: COUNT }).from(items).where(eq(items.status, "inbox"))),
      count(db.select({ n: COUNT }).from(items).where(and(eq(items.source, "agent"), eq(items.status, "active")))),
      count(db.select({ n: COUNT }).from(items).where(and(eq(items.source, "agent"), eq(items.status, "trashed")))),
    ]);
  const [byClient, byTool] = await Promise.all([
    db.select({ client: agents.client, n: COUNT }).from(agents).where(isNull(agents.revokedAt)).groupBy(agents.client),
    db
      .select({ action: activityLog.action, n: COUNT })
      .from(activityLog)
      .where(and(isNotNull(activityLog.agentId), gte(activityLog.createdAt, from)))
      .groupBy(activityLog.action)
      .orderBy(desc(COUNT)),
  ]);
  const decided = approved + dismissed;
  return {
    period,
    usersConnected,
    connected,
    usersActive,
    connectionRate: activeUsers ? Math.min(1, usersActive / activeUsers) : null,
    calls,
    writes,
    newConnections,
    inboxWaiting,
    approvalRate: decided ? approved / decided : null,
    byClient: byClient.map((r) => ({ client: r.client, n: Number(r.n) })),
    byTool: byTool.map((r) => ({ action: r.action, n: Number(r.n) })),
  };
}

/** Every agent connection, most recently used first (revoked ones last). */
export async function listAgents() {
  const rows = await db
    .select({
      id: agents.id,
      name: agents.name,
      client: agents.client,
      permission: agents.permission,
      autoApprove: agents.autoApprove,
      lastUsedAt: agents.lastUsedAt,
      createdAt: agents.createdAt,
      revokedAt: agents.revokedAt,
      email: users.email,
      plan: users.plan,
    })
    .from(agents)
    .innerJoin(users, eq(users.id, agents.userId))
    .orderBy(sql`${agents.revokedAt} IS NOT NULL`, sql`${agents.lastUsedAt} IS NULL`, desc(agents.lastUsedAt))
    .limit(200);
  return rows;
}

// ---------- Plans ----------

export async function planStats(period: Period) {
  const from = fromFor(period);
  const [total, pro, upgrades] = await Promise.all([
    count(db.select({ n: COUNT }).from(users)),
    count(db.select({ n: COUNT }).from(users).where(eq(users.plan, "pro"))),
    // Subscriptions whose row changed in the period: new upgrades, renewals and cancellations all touch it.
    count(db.select({ n: COUNT }).from(subscriptions).where(gte(subscriptions.updatedAt, from))),
  ]);
  return {
    period,
    revenue: await revenue(from),
    subscriptions: await subscriptionSummary(),
    users: { total, pro, free: total - pro },
    subscriptionChanges: upgrades,
    prices: PRICES,
    limits: PLAN_LIMITS,
  };
}

export async function listSubscriptions() {
  return db
    .select({
      email: users.email,
      name: users.name,
      status: subscriptions.status,
      interval: subscriptions.interval,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      updatedAt: subscriptions.updatedAt,
    })
    .from(subscriptions)
    .innerJoin(users, eq(users.id, subscriptions.userId))
    .orderBy(desc(subscriptions.updatedAt))
    .limit(200);
}

// ---------- Settings ----------

/** What's configured on the server. Never returns secret values, only whether they're set. */
export function settingsInfo() {
  const ai = aiAvailability();
  const key = process.env.STRIPE_SECRET_KEY;
  return {
    admins: adminEmails(),
    appUrl: process.env.BETTER_AUTH_URL ?? null,
    services: [
      {
        name: "Stripe (billing)",
        on: Boolean(key),
        detail: key ? (key.startsWith("sk_test_") ? "Test mode" : "Live mode") : "Not set up: upgrades show “Coming soon”",
      },
      {
        name: "Stripe webhook",
        on: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
        detail: process.env.STRIPE_WEBHOOK_SECRET ? "Signing secret set" : "Not set: plan changes won't sync",
      },
      { name: "Email (Resend)", on: Boolean(process.env.RESEND_API_KEY), detail: process.env.EMAIL_FROM ?? "No sender set" },
      { name: "Summaries (Anthropic)", on: ai.summaries, detail: ai.summaries ? SUMMARY_MODEL : "Off: no API key" },
      { name: "Search by meaning (Voyage)", on: ai.embeddings, detail: ai.embeddings ? EMBEDDING_MODEL : "Off: no API key" },
    ],
  };
}
