/**
 * Account deletion (SP-1): deleting a user must leave no rows behind.
 *
 * Needs a real MariaDB. Runs only when TEST_DATABASE_URL is set, e.g.
 *   TEST_DATABASE_URL=mysql://syncpads:syncpads@localhost:3306/syncpads_test npm test
 * The database is migrated automatically. Use a separate test database.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;

// Tables that intentionally have no user_id.
const NOT_USER_OWNED = new Set(["users", "verifications", "favicons", "__drizzle_migrations"]);

describe.skipIf(!url)("account deletion", () => {
  let mod: typeof import("@/db");
  let s: typeof import("@/db/schema");

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    mod = await import("@/db");
    s = await import("@/db/schema");
    const { runMigrations } = await import("@/db/migrate");
    await runMigrations();
  });

  afterAll(async () => {
    await mod?.pool.end();
  });

  async function tableNames(): Promise<string[]> {
    const [rows] = await mod.pool.query(
      "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()",
    );
    return (rows as { name: string }[]).map((r) => r.name);
  }

  it("every user-owned table has user_id with ON DELETE CASCADE to users", async () => {
    const [rows] = await mod.pool.query(`
      SELECT k.TABLE_NAME AS tableName, r.DELETE_RULE AS deleteRule
      FROM information_schema.KEY_COLUMN_USAGE k
      JOIN information_schema.REFERENTIAL_CONSTRAINTS r
        ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
      WHERE k.TABLE_SCHEMA = DATABASE()
        AND k.COLUMN_NAME = 'user_id'
        AND k.REFERENCED_TABLE_NAME = 'users'
    `);
    const cascading = new Map(
      (rows as { tableName: string; deleteRule: string }[]).map((r) => [r.tableName, r.deleteRule]),
    );

    for (const table of await tableNames()) {
      if (NOT_USER_OWNED.has(table)) continue;
      expect(cascading.get(table), `${table}.user_id must cascade to users`).toBe("CASCADE");
    }
  });

  it("deleting a user removes their rows from every table", async () => {
    const { db } = mod;
    const { upsertEmbedding } = await import("@/db/vector");
    const userId = crypto.randomUUID();
    const now = new Date(Date.now() + 86_400_000);

    await db.insert(s.users).values({ id: userId, email: `${userId}@test.local`, name: "Test" });
    await db.insert(s.userSettings).values({ userId, theme: "dark", wallpaper: { type: "none" } });
    await db.insert(s.sessions).values({ id: crypto.randomUUID(), userId, token: userId, expiresAt: now });
    await db.insert(s.accounts).values({
      id: crypto.randomUUID(), userId, accountId: userId, providerId: "credential", password: "x",
    });

    const pageId = crypto.randomUUID();
    const groupId = crypto.randomUUID();
    const itemId = crypto.randomUUID();
    const agentId = crypto.randomUUID();
    const widgetId = crypto.randomUUID();

    await db.insert(s.pages).values({ id: pageId, userId, name: "Home" });
    await db.insert(s.groups).values({ id: groupId, userId, pageId, name: "Tools" });
    await db.insert(s.agents).values({ id: agentId, userId, name: "Claude", client: "claude" });
    await db.insert(s.items).values({
      id: itemId, userId, groupId, type: "link", url: "https://example.com", createdByAgentId: agentId,
    });
    await db.insert(s.itemEnrichment).values({ itemId, userId, summary: "x", tags: ["a"] });
    await upsertEmbedding(db, {
      itemId, userId, model: "test", embedding: Array.from({ length: 1536 }, (_, i) => i / 1536),
    });
    await db.insert(s.widgets).values({ id: widgetId, userId, pageId, type: "rss", config: { feedUrl: "https://example.com/feed" } });
    await db.insert(s.feedItems).values({ userId, widgetId, title: "Post", url: "https://example.com/p" });
    await db.insert(s.agentScopes).values({ agentId, pageId, userId });
    await db.insert(s.activityLog).values({ userId, agentId, itemId, action: "add_link", after: { url: "x" } });

    const userOwned = (await tableNames()).filter((t) => !NOT_USER_OWNED.has(t));
    const counts = async () => {
      const result: Record<string, number> = {};
      for (const table of userOwned) {
        const [rows] = await mod.pool.query(`SELECT COUNT(*) AS n FROM \`${table}\` WHERE user_id = ?`, [userId]);
        result[table] = Number((rows as { n: number }[])[0].n);
      }
      return result;
    };

    // Sanity check: every user-owned table really got a row.
    for (const [table, n] of Object.entries(await counts())) {
      expect(n, `${table} should have a test row`).toBeGreaterThan(0);
    }

    await mod.pool.query("DELETE FROM users WHERE id = ?", [userId]);

    for (const [table, n] of Object.entries(await counts())) {
      expect(n, `${table} should be empty after delete`).toBe(0);
    }
  });
});

