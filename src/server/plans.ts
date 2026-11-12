/**
 * Free and Pro plans (SP-20). Limits from the PRD "Plans and limits" table.
 * When a Free user hits a limit, only that action is blocked, with a one-line
 * upgrade prompt; nothing already saved is ever removed.
 */
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { agents, items, pages, users } from "@/db/schema";

export type Plan = "free" | "pro";

export const PLAN_LIMITS = {
  free: {
    pages: 3,
    links: 500,
    agents: 1,
    agentsCanWrite: false, // Free agents are read-only
    summaries: 100, // auto-enrichment for the first 100 links
    meaningSearch: false, // keyword search only
    agentCallsPerDay: 2_000,
  },
  pro: {
    pages: Infinity,
    links: Infinity,
    agents: Infinity,
    agentsCanWrite: true,
    summaries: Infinity,
    meaningSearch: true,
    agentCallsPerDay: 10_000,
  },
} as const;

export const PRICES = { month: 5, year: 48 } as const; // US dollars

/** A Free-plan limit was reached. The message ends with the upgrade prompt. */
export class PlanLimitError extends Error {}

type Executor = Pick<typeof db, "select">;

export async function getPlan(userId: string, tx: Executor = db): Promise<Plan> {
  const [row] = await tx.select({ plan: users.plan }).from(users).where(eq(users.id, userId));
  return row?.plan === "pro" ? "pro" : "free";
}

async function count(tx: Executor, query: Promise<{ n: number }[]>) {
  const [row] = await query;
  return Number(row?.n ?? 0);
}

export async function pageCount(userId: string, tx: Executor = db) {
  return count(tx, tx.select({ n: sql<number>`COUNT(*)` }).from(pages).where(eq(pages.userId, userId)));
}

/** Links count toward the limit whether on a page or waiting in the inbox. */
export async function linkCount(userId: string, tx: Executor = db) {
  return count(
    tx,
    tx
      .select({ n: sql<number>`COUNT(*)` })
      .from(items)
      .where(and(eq(items.userId, userId), eq(items.type, "link"), inArray(items.status, ["active", "inbox"]))),
  );
}

export async function agentCount(userId: string, tx: Executor = db) {
  return count(tx, tx.select({ n: sql<number>`COUNT(*)` }).from(agents).where(and(eq(agents.userId, userId), isNull(agents.revokedAt))));
}

const upgrade = "Upgrade to Pro for unlimited";

/** Throws if adding `adding` pages would go over the Free limit. */
export async function assertCanAddPages(userId: string, adding: number, tx: Executor = db) {
  if ((await getPlan(userId, tx)) === "pro") return;
  const limit = PLAN_LIMITS.free.pages;
  const current = await pageCount(userId, tx);
  if (current + adding > limit) {
    throw new PlanLimitError(
      adding === 1
        ? `SyncPads Free includes ${limit} pages. ${upgrade} pages.`
        : `This would add ${adding} pages, and SyncPads Free includes ${limit} (you have ${current}). ${upgrade} pages.`,
    );
  }
}

/** Throws if adding `adding` links would go over the Free limit. */
export async function assertCanAddLinks(userId: string, adding: number, tx: Executor = db) {
  if (adding <= 0 || (await getPlan(userId, tx)) === "pro") return;
  const limit = PLAN_LIMITS.free.links;
  const current = await linkCount(userId, tx);
  if (current + adding > limit) {
    throw new PlanLimitError(
      adding === 1
        ? `SyncPads Free includes ${limit} links, and you've used them all. ${upgrade} links.`
        : `This would add ${adding.toLocaleString("en-US")} links, and SyncPads Free includes ${limit} (you have ${current}). ${upgrade} links.`,
    );
  }
}

/**
 * On Free, a user can connect one agent. Returns the name of another connected
 * agent that would block connecting `client`, or null if it's allowed.
 */
export async function freeAgentConflict(userId: string, client: { id: string; name: string }): Promise<string | null> {
  if ((await getPlan(userId)) === "pro") return null;
  const rows = await db
    .select({ name: agents.name, clientId: agents.clientId })
    .from(agents)
    .where(and(eq(agents.userId, userId), isNull(agents.revokedAt)));
  // Reconnecting the same app (same client, or same app name) isn't a second agent.
  const other = rows.find((a) => a.clientId !== client.id && a.name !== client.name);
  return other ? other.name : null;
}

/** What the Account settings page shows. */
export async function usage(userId: string) {
  const plan = await getPlan(userId);
  const [p, l, a] = await Promise.all([pageCount(userId), linkCount(userId), agentCount(userId)]);
  const limits = PLAN_LIMITS[plan];
  return {
    plan,
    pages: { used: p, limit: Number.isFinite(limits.pages) ? limits.pages : null },
    links: { used: l, limit: Number.isFinite(limits.links) ? limits.links : null },
    agents: { used: a, limit: Number.isFinite(limits.agents) ? limits.agents : null },
  };
}
