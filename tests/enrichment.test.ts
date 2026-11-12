/**
 * Enrichment queue, worker processing and search against a real MariaDB
 * (runs when TEST_DATABASE_URL is set). Page fetching and AI providers are faked.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const DIMS = 1024;

/** A unit vector pointing along one axis, so similarity is easy to control. */
const axis = (i: number) => Array.from({ length: DIMS }, (_, j) => (j === i ? 1 : 0));

describe.skipIf(!url)("enrichment and search", () => {
  let dbMod: typeof import("@/db");
  let schema: typeof import("@/db/schema");
  let sp: typeof import("@/server/start-page");
  let queue: typeof import("@/server/enrichment/queue");
  let proc: typeof import("@/server/enrichment/process");
  let searchMod: typeof import("@/server/search");
  const user = crypto.randomUUID();
  const other = crypto.randomUUID();
  let groupId = "";

  const pages: Record<string, { status: number; contentType: string; html: string }> = {
    "https://tracker.example.com/": {
      status: 200,
      contentType: "text/html",
      html: `<title>Tracker</title><meta name="description" content="Issue tracking"><main><p>${"Plan sprints, triage bugs and ship releases with your team. ".repeat(8)}</p></main>`,
    },
    "https://recipes.example.com/": {
      status: 200,
      contentType: "text/html",
      html: `<title>Weeknight Recipes</title><p>${"Quick pasta and curry dinners for busy evenings. ".repeat(8)}</p>`,
    },
    "https://gone.example.com/": { status: 404, contentType: "text/html", html: "nope" },
  };

  const deps = (overrides: Partial<import("@/server/enrichment/process").Deps> = {}): import("@/server/enrichment/process").Deps => ({
    fetchPage: async (u) => {
      const p = pages[u];
      if (!p) throw new Error("ECONNRESET");
      return { status: p.status, contentType: p.contentType, body: Buffer.from(p.html), finalUrl: u };
    },
    summarize: async (page) => ({
      summary: page.title === "Tracker" ? "A tool for planning sprints and tracking bugs." : "Fast dinner recipes for weeknights.",
      tags: page.title === "Tracker" ? ["project management", "bugs"] : ["cooking"],
    }),
    // Tracker -> axis 0, recipes -> axis 1.
    embed: async (texts) => texts.map((t) => (/sprint|bug|Tracker/i.test(t) ? axis(0) : axis(1))),
    availability: () => ({ summaries: true, embeddings: true }),
    ...overrides,
  });

  async function runQueue(d = deps()) {
    const results: string[] = [];
    for (;;) {
      const jobs = await queue.claim(dbMod.db, 10);
      if (jobs.length === 0) return results;
      for (const job of jobs) results.push(await proc.processJob(dbMod.db, job, d));
    }
  }

  async function enrichmentOf(itemId: string) {
    const { eq } = await import("drizzle-orm");
    const [row] = await dbMod.db.select().from(schema.itemEnrichment).where(eq(schema.itemEnrichment.itemId, itemId));
    return row;
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    dbMod = await import("@/db");
    schema = await import("@/db/schema");
    await (await import("@/db/migrate")).runMigrations();
    sp = await import("@/server/start-page");
    queue = await import("@/server/enrichment/queue");
    proc = await import("@/server/enrichment/process");
    searchMod = await import("@/server/search");
    for (const id of [user, other]) {
      // Pro: search by meaning and summaries for every link (Free limits are in billing.test.ts).
      await dbMod.db.insert(schema.users).values({ id, email: `${id}@test.local`, name: "T", plan: "pro" });
    }
    // Leave queued jobs from other test files out of this one.
    await dbMod.pool.query("UPDATE item_enrichment SET status = 'done' WHERE user_id NOT IN (?, ?)", [user, other]);
    groupId = (await sp.getState(user)).pages[0].groups[0].id;
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await dbMod.pool.query("DELETE FROM users WHERE id IN (?, ?)", [user, other]);
    await dbMod.pool.end();
  });

  it("queues new links and fills in titles without AI while smart features are off", async () => {
    const a = await sp.createItem(user, { groupId, type: "link", url: "tracker.example.com" });
    const b = await sp.createItem(user, { groupId, type: "link", url: "recipes.example.com", title: "My dinners" });
    expect((await enrichmentOf(a.item.id)).status).toBe("pending");

    const summarize = vi.fn(deps().summarize);
    expect(await runQueue(deps({ summarize }))).toEqual(["done", "done"]);
    expect(summarize).not.toHaveBeenCalled(); // no consent, no AI

    const state = await sp.getState(user);
    const byId = new Map(state.pages[0].groups[0].items.map((i) => [i.id, i]));
    expect(byId.get(a.item.id)?.title).toBe("Tracker"); // untitled link got the page title
    expect(byId.get(b.item.id)?.title).toBe("My dinners"); // the user's own title is kept
    expect((await enrichmentOf(a.item.id)).textSnapshot).toContain("Plan sprints");
    expect(byId.get(a.item.id)?.summary).toBeNull();
  });

  it("summarizes and embeds existing links once smart features are turned on", async () => {
    const before = await sp.getRevision(user);
    await sp.updateSettings(user, { aiEnabled: true });
    expect(await runQueue()).toEqual(["done", "done"]);

    const state = await sp.getState(user);
    expect(state.settings.aiEnabled).toBe(true);
    const tracker = state.pages[0].groups[0].items.find((i) => i.title === "Tracker")!;
    expect(tracker.summary).toBe("A tool for planning sprints and tracking bugs.");
    expect(tracker.tags).toEqual(["project management", "bugs"]);
    expect(state.revision).toBeGreaterThan(before + 1); // open pages refresh to show summaries

    const [rows] = await dbMod.pool.query("SELECT COUNT(*) AS n FROM item_embeddings WHERE user_id = ?", [user]);
    expect((rows as { n: number }[])[0].n).toBe(2);
  });

  it("finds links by keyword, by page text and by meaning, never another user's", async () => {
    // Keyword in the summary / tags.
    let res = await searchMod.search(user, { query: "bugs" });
    expect(res.results.map((r) => r.title)).toEqual(["Tracker"]);
    expect(res.results[0]).toMatchObject({ pageName: "Home", groupName: "Favorites", tags: ["project management", "bugs"] });

    // Words that only appear in the fetched page text (FULLTEXT).
    res = await searchMod.search(user, { query: "curry" });
    expect(res.results.map((r) => r.title)).toEqual(["My dinners"]);

    // By meaning: the fake query embedding points at the tracker.
    process.env.VOYAGE_API_KEY = "test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ data: [{ embedding: axis(0), index: 0 }] })),
    );
    res = await searchMod.search(user, { query: "agile workflow software" }); // no shared words
    expect(res.meaning).toBe(true);
    expect(res.results[0]).toMatchObject({ title: "Tracker", matchedBy: ["meaning"] });
    vi.unstubAllGlobals();
    delete process.env.VOYAGE_API_KEY;

    // Tag filter, and isolation between users.
    res = await searchMod.search(user, { query: "dinners", tag: "cooking" });
    expect(res.results.map((r) => r.title)).toEqual(["My dinners"]);
    expect((await searchMod.search(other, { query: "bugs" })).results).toEqual([]);
  });

  it("re-processes a link when its address changes, and handles failures", async () => {
    const state = await sp.getState(user);
    const recipes = state.pages[0].groups[0].items.find((i) => i.title === "My dinners")!;
    await sp.updateItem(user, recipes.id, { url: "https://gone.example.com/" });
    expect(await runQueue()).toEqual(["failed"]); // 404: give up, keep the link
    const row = await enrichmentOf(recipes.id);
    expect(row).toMatchObject({ status: "failed", error: "Fetch: HTTP 404", summary: null });

    // Network errors retry later with backoff.
    const flaky = await sp.createItem(user, { groupId, type: "link", url: "unreachable.example.com" });
    expect(await runQueue()).toEqual(["retry"]);
    const retry = await enrichmentOf(flaky.item.id);
    expect(retry.status).toBe("pending");
    expect(retry.nextAttemptAt!.getTime()).toBeGreaterThan(Date.now());
    expect(retry.error).toContain("ECONNRESET");
  });

  it("indexes notes by their text and imports queue every link", async () => {
    const note = await sp.createItem(user, { groupId, type: "note", noteBody: "<p>Quarterly planning checklist</p>" });
    await runQueue();
    expect((await enrichmentOf(note.item.id)).textSnapshot).toBe("Quarterly planning checklist");
    const res = await searchMod.search(user, { query: "checklist" });
    expect(res.results[0]).toMatchObject({ type: "note", snippet: "Quarterly planning checklist" });

    const imported = await sp.importBookmarks(user, [
      { title: "Bar", children: [{ title: "T", url: "https://tracker.example.com/" }, { title: "R", url: "https://recipes.example.com/" }] },
    ]);
    const [rows] = await dbMod.pool.query(
      "SELECT COUNT(*) AS n FROM item_enrichment e JOIN items i ON i.id = e.item_id JOIN `groups` g ON g.id = i.group_id WHERE g.page_id = ? AND e.status = 'pending'",
      [imported.pageIds[0]],
    );
    expect((rows as { n: number }[])[0].n).toBe(2);
  });
});
