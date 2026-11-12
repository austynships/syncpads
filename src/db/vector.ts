/**
 * Helpers for the MariaDB VECTOR column on item_embeddings.
 * Used from Phase 4 (enrichment and search by meaning).
 */
import { sql } from "drizzle-orm";
import type { Db } from "./index";
import { EMBEDDING_DIMENSIONS } from "./types";

export async function upsertEmbedding(
  db: Db,
  input: { itemId: string; userId: string; model: string; embedding: number[] },
) {
  if (input.embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Embedding must have ${EMBEDDING_DIMENSIONS} dimensions`);
  }
  const vectorText = JSON.stringify(input.embedding);
  await db.execute(sql`
    INSERT INTO item_embeddings (item_id, user_id, model, embedding)
    VALUES (${input.itemId}, ${input.userId}, ${input.model}, VEC_FromText(${vectorText}))
    ON DUPLICATE KEY UPDATE
      model = VALUES(model),
      embedding = VALUES(embedding),
      created_at = CURRENT_TIMESTAMP(3)
  `);
}

/** Nearest items for one user by cosine distance (smaller = closer). */
export async function searchEmbeddings(
  db: Db,
  input: { userId: string; embedding: number[]; limit?: number },
) {
  const vectorText = JSON.stringify(input.embedding);
  const limit = Math.min(Math.max(input.limit ?? 10, 1), 50);
  const [rows] = await db.execute(sql`
    SELECT item_id AS itemId,
           VEC_DISTANCE_COSINE(embedding, VEC_FromText(${vectorText})) AS distance
    FROM item_embeddings
    WHERE user_id = ${input.userId}
    ORDER BY distance
    LIMIT ${limit}
  `);
  return rows as unknown as { itemId: string; distance: number }[];
}

