/**
 * Search (SP-14): finds a user's links and notes by keyword and, when smart
 * features are on, by meaning. The two ranked lists are merged with
 * reciprocal rank fusion, so an item that both finds ranks highest.
 * Also used by the MCP `search` tool in Phase 5.
 */
import { eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { users, userSettings } from "@/db/schema";
import { searchEmbeddings } from "@/db/vector";
import { displayHost } from "@/lib/url";
import { aiAvailability, embed } from "./enrichment/ai";

export type SearchResult = {
  id: string;
  type: "link" | "note";
  url: string | null;
  title: string;
  summary: string | null;
  tags: string[];
  snippet: string | null; // note text, for notes
  pageId: string;
  pageName: string;
  groupId: string;
  groupName: string;
  matchedBy: ("keyword" | "meaning")[];
};

export type SearchInput = {
  query: string;
  pageId?: string;
  tag?: string;
  limit?: number;
  /** Agents only: the pages this agent may see (hidden and out-of-scope pages left out). */
  allowedPageIds?: string[];
};

/** Words to match, without LIKE wildcards. */
export function searchTerms(query: string): string[] {
  return [...new Set(query.toLowerCase().split(/\s+/).map((t) => t.trim()).filter((t) => t.length >= 2))].slice(0, 6);
}

const likePattern = (term: string) => `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** Reciprocal rank fusion of several ranked id lists. */
export function fuseRanks(lists: string[][], k = 60): string[] {
  const score = new Map<string, number>();
  for (const list of lists) {
    list.forEach((id, rank) => score.set(id, (score.get(id) ?? 0) + 1 / (k + rank + 1)));
  }
  return [...score.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

type Row = {
  id: string;
  type: "link" | "note";
  url: string | null;
  title: string | null;
  noteBody: string | null;
  pageId: string;
  pageName: string;
  groupId: string;
  groupName: string;
  summary: string | null;
  tags: string | string[] | null;
  pageTitle: string | null;
  snapshot: string | null;
};

function selectItems(userId: string, where: SQL, extra: SQL = sql``) {
  return db.execute(sql`
    SELECT i.id, i.type, i.url, i.title, i.note_body AS noteBody,
           p.id AS pageId, p.name AS pageName, g.id AS groupId, g.name AS groupName,
           e.summary, e.tags, e.title AS pageTitle, e.text_snapshot AS snapshot
           ${extra}
    FROM items i
    JOIN \`groups\` g ON g.id = i.group_id
    JOIN pages p ON p.id = g.page_id
    LEFT JOIN item_enrichment e ON e.item_id = i.id
    WHERE i.user_id = ${userId} AND i.status = 'active' AND ${where}
  `);
}

function filters(input: SearchInput): SQL {
  const parts: SQL[] = [sql`1 = 1`];
  if (input.pageId) parts.push(sql`p.id = ${input.pageId}`);
  if (input.allowedPageIds) {
    parts.push(
      input.allowedPageIds.length
        ? sql`p.id IN (${sql.join(input.allowedPageIds.map((id) => sql`${id}`), sql`, `)})`
        : sql`1 = 0`,
    );
  }
  if (input.tag) parts.push(sql`JSON_CONTAINS(e.tags, JSON_QUOTE(${input.tag.toLowerCase()}))`);
  return sql.join(parts, sql` AND `);
}

/** Keyword matches, best first: title, address, tags and summary count most; page text via the FULLTEXT index. */
async function keywordSearch(userId: string, input: SearchInput, limit: number): Promise<string[]> {
  const terms = searchTerms(input.query);
  if (terms.length === 0) return [];
  const termScores = terms.map((t) => {
    const p = likePattern(t);
    return sql`(
      (LOWER(COALESCE(i.title, '')) LIKE ${p}) * 4 + (LOWER(COALESCE(e.title, '')) LIKE ${p}) * 3 +
      (LOWER(COALESCE(i.url, '')) LIKE ${p}) * 2 + (LOWER(COALESCE(e.tags, '')) LIKE ${p}) * 3 +
      (LOWER(COALESCE(e.summary, '')) LIKE ${p}) * 2 + (LOWER(COALESCE(i.note_body, '')) LIKE ${p}) * 2
    )`;
  });
  const score = sql`(${sql.join(termScores, sql` + `)} +
    COALESCE(MATCH(e.title, e.summary, e.text_snapshot) AGAINST (${input.query} IN NATURAL LANGUAGE MODE), 0))`;
  const [rows] = await db.execute(sql`
    SELECT i.id, ${score} AS score
    FROM items i
    JOIN \`groups\` g ON g.id = i.group_id
    JOIN pages p ON p.id = g.page_id
    LEFT JOIN item_enrichment e ON e.item_id = i.id
    WHERE i.user_id = ${userId} AND i.status = 'active' AND ${filters(input)}
    HAVING score > 0
    ORDER BY score DESC
    LIMIT ${limit}
  `);
  return (rows as unknown as { id: string }[]).map((r) => r.id);
}

/** Nearest items by meaning, or [] when smart features are off or unavailable. */
async function meaningSearch(userId: string, input: SearchInput, limit: number): Promise<string[]> {
  if (!aiAvailability().embeddings || input.query.trim().length < 3) return [];
  const [settings] = await db.select({ aiEnabled: userSettings.aiEnabled }).from(userSettings).where(eq(userSettings.userId, userId));
  if (!settings?.aiEnabled) return [];
  // Search by meaning is a Pro feature (SP-20).
  const [owner] = await db.select({ plan: users.plan }).from(users).where(eq(users.id, userId));
  if (owner?.plan !== "pro") return [];
  try {
    const [vector] = await embed([input.query.trim().slice(0, 500)], "query");
    const nearest = await searchEmbeddings(db, { userId, embedding: vector, limit });
    // Cosine distance: 0 is identical. Beyond ~0.75 results are rarely related.
    return nearest.filter((n) => Number(n.distance) < 0.75).map((n) => n.itemId);
  } catch (err) {
    console.error("[search] meaning search unavailable:", (err as Error).message);
    return [];
  }
}

export async function search(userId: string, input: SearchInput): Promise<{ results: SearchResult[]; meaning: boolean }> {
  const limit = Math.min(Math.max(input.limit ?? 10, 1), 50);
  const [byKeyword, byMeaning] = await Promise.all([
    keywordSearch(userId, input, 30),
    meaningSearch(userId, input, 30),
  ]);
  const ids = fuseRanks([byKeyword, byMeaning]).slice(0, 60);
  if (ids.length === 0) return { results: [], meaning: byMeaning.length > 0 };

  // Load details (meaning matches still have to pass the page/tag filters).
  const [rows] = await selectItems(userId, sql`i.id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)}) AND ${filters(input)}`);
  const byId = new Map((rows as unknown as Row[]).map((r) => [r.id, r]));
  const keywordSet = new Set(byKeyword);
  const meaningSet = new Set(byMeaning);

  const results: SearchResult[] = [];
  for (const id of ids) {
    const r = byId.get(id);
    if (!r) continue;
    const tags = typeof r.tags === "string" ? (JSON.parse(r.tags) as string[]) : (r.tags ?? []);
    results.push({
      id: r.id,
      type: r.type,
      url: r.url,
      title: r.title || r.pageTitle || (r.url ? displayHost(r.url) : "Note"),
      summary: r.summary,
      tags,
      snippet: r.type === "note" ? (r.snapshot ?? "").slice(0, 200) || null : null,
      pageId: r.pageId,
      pageName: r.pageName,
      groupId: r.groupId,
      groupName: r.groupName,
      matchedBy: [...(keywordSet.has(id) ? ["keyword" as const] : []), ...(meaningSet.has(id) ? ["meaning" as const] : [])],
    });
    if (results.length >= limit) break;
  }
  return { results, meaning: byMeaning.length > 0 };
}
