/**
 * Admin dashboard data. Admins are listed by email in ADMIN_EMAILS (comma
 * separated) in the server's .env, and must have verified their email.
 * Everything here is read-only.
 */
import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, agents, items, pages, sessions, subscriptions, userSettings, users } from "@/db/schema";
import { billingAvailable, stripe } from "./billing";
import { PRICES } from "./plans";

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

async function count(query: Promise<{ n: number }[]>) {
  const [row] = await query;
  return Number(row?.n ?? 0);
}

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
    return {
      total,
      charges,
      available: usd(balance.available),
      pending: usd(balance.pending),
      livemode: !process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_"),
    };
  } catch (err) {
    console.error("[admin] revenue unavailable:", (err as Error).message);
    return null;
  }
}

/**
 * Sign-ups over the period, one bar per hour for "day" and per day otherwise.
 * Keys match the bucket labels built in JS (UTC, like the database).
 */
async function signupSeries(period: Period, from: Date) {
  const hourly = period === "day";
  const fmt = hourly ? "%Y-%m-%dT%H" : "%Y-%m-%d";
  const rows = await db
    .select({ key: sql<string>`DATE_FORMAT(${users.createdAt}, ${fmt})`, n: sql<number>`COUNT(*)` })
    .from(users)
    .where(gte(users.createdAt, from))
    .groupBy(sql`DATE_FORMAT(${users.createdAt}, ${fmt})`);
  const byKey = new Map(rows.map((r) => [String(r.key), Number(r.n)]));
  const buckets = hourly ? 24 : PERIODS[period];
  const step = hourly ? 3_600_000 : DAY;
  return Array.from({ length: buckets }, (_, i) => {
    const at = new Date(Date.now() - (buckets - 1 - i) * step);
    const key = at.toISOString().slice(0, hourly ? 13 : 10);
    return {
      key,
      label: hourly ? `${key.slice(11, 13)}:00` : key.slice(5),
      n: byKey.get(key) ?? 0,
    };
  });
}

export async function adminStats(period: Period = "week") {
  const from = since(PERIODS[period]);
  const [
    totalUsers,
    verifiedUsers,
    proUsers,
    newUsers,
    activeUsers,
    links,
    linksAdded,
    notes,
    notesAdded,
    totalPages,
    pagesAdded,
    agentUsers,
    activeAgents,
    agentUsersActive,
    agentCalls,
    agentWrites,
    smartUsers,
    inboxWaiting,
    agentItemsApproved,
    agentItemsDismissed,
  ] = await Promise.all([
    count(db.select({ n: sql<number>`COUNT(*)` }).from(users)),
    count(db.select({ n: sql<number>`COUNT(*)` }).from(users).where(eq(users.emailVerified, true))),
    count(db.select({ n: sql<number>`COUNT(*)` }).from(users).where(eq(users.plan, "pro"))),
    count(db.select({ n: sql<number>`COUNT(*)` }).from(users).where(gte(users.createdAt, from))),
    // Active = signed in or used SyncPads (session refreshed) in the period.
    count(db.select({ n: sql<number>`COUNT(DISTINCT ${sessions.userId})` }).from(sessions).where(gte(sessions.updatedAt, from))),
    count(db.select({ n: sql<number>`COUNT(*)` }).from(items).where(and(eq(items.type, "link"), eq(items.status, "active")))),
    count(
      db
        .select({ n: sql<number>`COUNT(*)` })
        .from(items)
        .where(and(eq(items.type, "link"), eq(items.status, "active"), gte(items.createdAt, from))),
    ),
    count(db.select({ n: sql<number>`COUNT(*)` }).from(items).where(and(eq(items.type, "note"), eq(items.status, "active")))),
    count(
      db
        .select({ n: sql<number>`COUNT(*)` })
        .from(items)
        .where(and(eq(items.type, "note"), eq(items.status, "active"), gte(items.createdAt, from))),
    ),
    count(db.select({ n: sql<number>`COUNT(*)` }).from(pages)),
    count(db.select({ n: sql<number>`COUNT(*)` }).from(pages).where(gte(pages.createdAt, from))),
    count(db.select({ n: sql<number>`COUNT(DISTINCT ${agents.userId})` }).from(agents).where(isNull(agents.revokedAt))),
    count(db.select({ n: sql<number>`COUNT(*)` }).from(agents).where(isNull(agents.revokedAt))),
    count(
      db
        .select({ n: sql<number>`COUNT(DISTINCT ${agents.userId})` })
        .from(agents)
        .where(and(isNull(agents.revokedAt), gte(agents.lastUsedAt, from))),
    ),
    count(db.select({ n: sql<number>`COUNT(*)` }).from(activityLog).where(gte(activityLog.createdAt, from))),
    count(
      db
        .select({ n: sql<number>`COUNT(*)` })
        .from(activityLog)
        .where(and(sql`${activityLog.action} IN ('add_link', 'save_context')`, gte(activityLog.createdAt, from))),
    ),
    count(db.select({ n: sql<number>`COUNT(*)` }).from(userSettings).where(eq(userSettings.aiEnabled, true))),
    count(db.select({ n: sql<number>`COUNT(*)` }).from(items).where(eq(items.status, "inbox"))),
    count(db.select({ n: sql<number>`COUNT(*)` }).from(items).where(and(eq(items.source, "agent"), eq(items.status, "active")))),
    count(db.select({ n: sql<number>`COUNT(*)` }).from(items).where(and(eq(items.source, "agent"), eq(items.status, "trashed")))),
  ]);

  // Subscriptions mirrored from Stripe (Pro users without one, such as comped accounts, aren't counted).
  const subs = await db
    .select({ status: subscriptions.status, interval: subscriptions.interval, cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd })
    .from(subscriptions);
  const paying = subs.filter((s) => ["active", "trialing", "past_due"].includes(s.status));
  const mrrCents = paying.reduce((sum, s) => sum + (s.interval === "year" ? (PRICES.year * 100) / 12 : PRICES.month * 100), 0);

  const agentsByClient = await db
    .select({ client: agents.client, n: sql<number>`COUNT(*)` })
    .from(agents)
    .where(isNull(agents.revokedAt))
    .groupBy(agents.client);

  const recentUsers = await db
    .select({
      email: users.email,
      name: users.name,
      plan: users.plan,
      verified: users.emailVerified,
      createdAt: users.createdAt,
      // Written out as users.id: an interpolated column would render unqualified and match the subquery's own id.
      links: sql<number>`(SELECT COUNT(*) FROM items i WHERE i.user_id = users.id AND i.type = 'link' AND i.status = 'active')`,
      agents: sql<number>`(SELECT COUNT(*) FROM agents a WHERE a.user_id = users.id AND a.revoked_at IS NULL)`,
    })
    .from(users)
    .orderBy(sql`${users.createdAt} DESC`)
    .limit(25);

  const decided = agentItemsApproved + agentItemsDismissed;
  return {
    period,
    generatedAt: new Date(),
    revenue: await revenue(from),
    subscriptions: {
      paying: paying.length,
      monthly: paying.filter((s) => s.interval === "month").length,
      yearly: paying.filter((s) => s.interval === "year").length,
      cancelling: paying.filter((s) => s.cancelAtPeriodEnd).length,
      pastDue: paying.filter((s) => s.status === "past_due").length,
      mrrCents: Math.round(mrrCents),
    },
    users: {
      total: totalUsers,
      verified: verifiedUsers,
      pro: proUsers,
      new: newUsers,
      active: activeUsers,
      smartFeatures: smartUsers,
    },
    content: { links, linksAdded, notes, notesAdded, pages: totalPages, pagesAdded },
    mcp: {
      usersConnected: agentUsers,
      activeAgents,
      usersActive: agentUsersActive,
      calls: agentCalls,
      writes: agentWrites,
      inboxWaiting,
      approvalRate: decided ? agentItemsApproved / decided : null,
      // The PRD's gate metric: active users who used a connected agent ÷ active users, over the period.
      connectionRate: activeUsers ? Math.min(1, agentUsersActive / activeUsers) : null,
      byClient: agentsByClient.map((r) => ({ client: r.client, n: Number(r.n) })),
    },
    signups: await signupSeries(period, from),
    recentUsers: recentUsers.map((u) => ({ ...u, links: Number(u.links), agents: Number(u.agents) })),
  };
}

export type AdminStats = Awaited<ReturnType<typeof adminStats>>;
