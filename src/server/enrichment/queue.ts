/**
 * The enrichment job queue (SP-13). Each item_enrichment row is one job:
 *   pending -> processing (claimed by a worker) -> done | failed,
 * with retries via next_attempt_at. Lives in MariaDB, so jobs survive restarts
 * and are written in the same transaction as the item they belong to.
 */
import { sql } from "drizzle-orm";
import type { Db } from "@/db";

type Executor = Pick<Db, "execute">;

export type Job = { itemId: string; userId: string; attempts: number };

/**
 * Queues items for enrichment. `refetch` (the default) forgets the previous
 * fetch, summary and embedding, e.g. because the URL or note text changed.
 */
export async function enqueue(db: Executor, userId: string, itemIds: string[], { refetch = true } = {}) {
  for (let start = 0; start < itemIds.length; start += 500) {
    const chunk = itemIds.slice(start, start + 500);
    const values = sql.join(
      chunk.map((id) => sql`(${id}, ${userId}, 'pending')`),
      sql`, `,
    );
    await db.execute(sql`
      INSERT INTO item_enrichment (item_id, user_id, status) VALUES ${values}
      ON DUPLICATE KEY UPDATE
        status = 'pending', attempts = 0, next_attempt_at = NULL, error = NULL,
        claim_token = NULL, claimed_at = NULL
        ${refetch ? sql`, fetched_at = NULL, title = NULL, text_snapshot = NULL, summary = NULL, tags = NULL,
          summarized_at = NULL, embedded_at = NULL` : sql``}
    `);
    // The old embedding describes the old content: drop it so search can't find it by that.
    if (refetch) {
      await db.execute(sql`DELETE FROM item_embeddings WHERE item_id IN (${sql.join(chunk.map((id) => sql`${id}`), sql`, `)})`);
    }
  }
}

/** After a user turns smart features on: process everything that has no summary or embedding yet (reusing fetched text). */
export async function requeueForAi(db: Executor, userId: string) {
  await db.execute(sql`
    UPDATE item_enrichment
    SET status = 'pending', attempts = 0, next_attempt_at = NULL, error = NULL
    WHERE user_id = ${userId} AND status IN ('done', 'failed') AND (summarized_at IS NULL OR embedded_at IS NULL)
  `);
}

/** Queues active items that have never been enriched (items saved before Phase 4). */
export async function enqueueMissing(db: Executor) {
  await db.execute(sql`
    INSERT IGNORE INTO item_enrichment (item_id, user_id, status)
    SELECT i.id, i.user_id, 'pending' FROM items i
    LEFT JOIN item_enrichment e ON e.item_id = i.id
    WHERE e.item_id IS NULL AND i.status = 'active'
  `);
}

/** Claims up to `limit` due jobs for this worker. */
export async function claim(db: Executor, limit: number): Promise<Job[]> {
  const token = crypto.randomUUID();
  await db.execute(sql`
    UPDATE item_enrichment
    SET status = 'processing', claim_token = ${token}, claimed_at = NOW(3), attempts = attempts + 1
    WHERE status = 'pending' AND (next_attempt_at IS NULL OR next_attempt_at <= NOW(3))
    ORDER BY created_at
    LIMIT ${limit}
  `);
  const [rows] = await db.execute(sql`
    SELECT item_id AS itemId, user_id AS userId, attempts FROM item_enrichment WHERE claim_token = ${token}
  `);
  return rows as unknown as Job[];
}

/** Jobs stuck in "processing" (worker crashed or restarted) go back in the queue. */
export async function releaseStale(db: Executor, minutes = 10) {
  await db.execute(sql`
    UPDATE item_enrichment SET status = 'pending', claim_token = NULL
    WHERE status = 'processing' AND claimed_at < NOW(3) - INTERVAL ${minutes} MINUTE
  `);
}

export const MAX_ATTEMPTS = 4;

/** Schedules a retry with exponential backoff (2, 4, 8 minutes), or gives up. */
export async function retryLater(db: Executor, job: Job, error: string) {
  const giveUp = job.attempts >= MAX_ATTEMPTS;
  const delayMinutes = 2 ** job.attempts;
  await db.execute(sql`
    UPDATE item_enrichment
    SET status = ${giveUp ? "failed" : "pending"},
        next_attempt_at = ${giveUp ? null : sql`NOW(3) + INTERVAL ${delayMinutes} MINUTE`},
        error = ${error.slice(0, 255)}, claim_token = NULL
    WHERE item_id = ${job.itemId}
  `);
}
