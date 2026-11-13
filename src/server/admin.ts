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

const DAY = 86_400_000;
const since = (days: number) => new Date(Date.now() - days * DAY);

async function count(query: Promise<{ n: number }[]>) {
  const [row] = await query;
  return Number(row?.n ?? 0);
}

/** Revenue from Stripe, net of refunds, in US cents. Null when billing isn't set up or Stripe can't be reached. */
async function revenue() {
  if (!billingAvailable()) return null;
  try {
    const periods = { day: since(1), week: since(7), month: since(30) };
    const totals = { day: 0, week: 0, month: 0 };
    let charges = 0;
    const from = Math.floor(periods.month.getTime() / 1000);
    for await (const charge of stripe().charges.list({ created: { gte: from }, limit: 100 })) {
      if (!charge.paid || charge.status !== "succeeded") continue;
      const net = charge.amount - (charge.amount_refunded ?? 0);
      const at = charge.created * 1000;
      charges++;
      totals.month += net;
      if (at >= periods.week.getTime()) totals.week += net;
      if (at >= periods.day.getTime()) totals.day += net;
    }
    const balance = await stripe().balance.retrieve();
    const usd = (list: { amount: number; currency: string }[]) =>
      list.filter((b) => b.currency === "usd").reduce((s, b) => s + b.amount, 0);
    return {
      ...totals,
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

export async function adminStats() {
  const [
    totalUsers,
    verifiedUsers,
    proUsers,
    newUsersDay,
    newUsersWeek,
    newUsersMonth,
    activeUsersWeek,
    links,
    linksWeek,
    notes,
    totalPages,
    pagesWeek,
    agentUsers,
    activeAgents,
    agentUsersActiveWeek,
    agentCallsDay,
    agentCallsWeek,
    agentWritesWeek,
    smartUsers,
    inboxWaiting,
    agentItemsApproved,
    agentItemsDismissed,
  ] = await Promise.all([
    count(db.select({ n: sql<number>`COUNT(*)` }).from(users)),
    count(db.select({ n: sql<number>`COUNT(*)` }).from(users).where(eq(users.emailVerified, true))),
    count(db.select({ n: sql<number>`COUNT(*)` }).from(users).where(eq(users.plan, "pro"))),
    count(db.select({ n: sql<number>`COUNT(*)` }).from(users).where(gte(users.createdAt, since(1)))),
    count(db.select({ n: sql<number>`COUNT(*)` }).from(users).where(gte(users.createdAt, since(7)))),
    count(db.select({ n: sql<number>`COUNT(*)` }).from(users).where(gte(users.createdAt, since(30)))),
    // Active = signed in or used SyncPads (session refreshed) in the last 7 days.
    count(db.select({ n: sql<number>`COUNT(DISTINCT ${sessions.userId})` }).from(sessions).where(gte(sessions.updatedAt, since(7)))),
    count(db.select({ n: sql<number>`COUNT(*)` }).from(items).where(and(eq(items.type, "link"), eq(items.status, "active")))),
    count(
      db
        .select({ n: sql<number>`COUNT(*)` })
        .from(items)
        .where(and(eq(items.type, "link"), eq(items.status, "active"), gte(items.createdAt, since(7)))),
    ),
    count(db.select({ n: sql<number>`COUNT(*)` }).from(items).where(and(eq(items.type, "note"), eq(items.status, "active")))),
    count(db.select({ n: sql<number>`COUNT(*)` }).from(pages)),
    count(db.select({ n: sql<number>`COUNT(*)` }).from(pages).where(gte(pages.createdAt, since(7)))),
    count(db.select({ n: sql<number>`COUNT(DISTINCT ${agents.userId})` }).from(agents).where(isNull(agents.revokedAt))),
    count(db.select({ n: sql<number>`COUNT(*)` }).from(agents).where(isNull(agents.revokedAt))),
    count(
      db
        .select({ n: sql<number>`COUNT(DISTINCT ${agents.userId})` })
        .from(agents)
        .where(and(isNull(agents.revokedAt), gte(agents.lastUsedAt, since(7)))),
    ),
    count(db.select({ n: sql<number>`COUNT(*)` }).from(activityLog).where(gte(activityLog.createdAt, since(1)))),
    count(db.select({ n: sql<number>`COUNT(*)` }).from(activityLog).where(gte(activityLog.createdAt, since(7)))),
    count(
      db
        .select({ n: sql<number>`COUNT(*)` })
        .from(activityLog)
        .where(and(sql`${activityLog.action} IN ('add_link', 'save_context')`, gte(activityLog.createdAt, since(7)))),
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

  const signupsByDay = await db
    .select({ day: sql<string>`DATE(${users.createdAt})`, n: sql<number>`COUNT(*)` })
    .from(users)
    .where(gte(users.createdAt, since(30)))
    .groupBy(sql`DATE(${users.createdAt})`);

  const recentUsers = await db
    .select({
      email: users.email,
      name: users.name,
      plan: users.plan,
      verified: users.emailVerified,
      createdAt: users.createdAt,
      links: sql<number>`(SELECT COUNT(*) FROM items i WHERE i.user_id = users.id AND i.type = 'link' AND i.status = 'active')`,
      agents: sql<number>`(SELECT COUNT(*) FROM agents a WHERE a.user_id = users.id AND a.revoked_at IS NULL)`,
    })
    .from(users)
    .orderBy(sql`${users.createdAt} DESC`)
    .limit(25);

  const decided = agentItemsApproved + agentItemsDismissed;
  return {
    generatedAt: new Date(),
    revenue: await revenue(),
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
      newDay: newUsersDay,
      newWeek: newUsersWeek,
      newMonth: newUsersMonth,
      activeWeek: activeUsersWeek,
      smartFeatures: smartUsers,
    },
    content: { links, linksWeek, notes, pages: totalPages, pagesWeek },
    mcp: {
      usersConnected: agentUsers,
      activeAgents,
      usersActiveWeek: agentUsersActiveWeek,
      callsDay: agentCallsDay,
      callsWeek: agentCallsWeek,
      writesWeek: agentWritesWeek,
      inboxWaiting,
      approvalRate: decided ? agentItemsApproved / decided : null,
      // The PRD's gate metric: weekly active users with a connected agent ÷ weekly active users.
      connectionRate: activeUsersWeek ? Math.min(1, agentUsersActiveWeek / activeUsersWeek) : null,
      byClient: agentsByClient.map((r) => ({ client: r.client, n: Number(r.n) })),
    },
    signupsByDay: signupsByDay.map((r) => ({ day: String(r.day).slice(0, 10), n: Number(r.n) })),
    recentUsers: recentUsers.map((u) => ({ ...u, links: Number(u.links), agents: Number(u.agents) })),
  };
}

export type AdminStats = Awaited<ReturnType<typeof adminStats>>;
