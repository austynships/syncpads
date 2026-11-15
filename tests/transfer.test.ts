/**
 * Import and export of pages (SP-10). The file format and bookmarks HTML are
 * checked without a database; the round trip runs when TEST_DATABASE_URL is set.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseBookmarksHtml, planImport } from "@/lib/bookmarks";
import { exportFileName, parseSyncPadsFile, toBookmarksHtml, type SyncPadsFile } from "@/lib/syncpads-file";

const sample: SyncPadsFile = {
  format: "syncpads",
  version: 1,
  pages: [
    {
      name: "Work & Clients",
      layout: "3",
      hiddenFromAgents: true,
      groups: [
        {
          name: "Acme <redesign>",
          layout: "tiles",
          items: [
            { type: "link", url: "https://acme.example.com/brief?a=1&b=2", title: "Acme \"brief\"" },
            { type: "note", title: "Decisions", body: "<p>Use orange</p>" },
          ],
        },
      ],
    },
  ],
};

describe("SyncPads file", () => {
  it("accepts a valid file and rejects others with a plain message", () => {
    expect(parseSyncPadsFile(sample).pages[0].name).toBe("Work & Clients");
    expect(() => parseSyncPadsFile({ format: "other", version: 1, pages: [] })).toThrow();
    expect(() => parseSyncPadsFile({ ...sample, version: 99 })).toThrow(/newer version/);
    expect(() => parseSyncPadsFile({ ...sample, pages: [] })).toThrow(/no pages/);
  });

  it("writes browser bookmarks that import back as the same pages and groups, without notes", () => {
    const html = toBookmarksHtml(sample.pages);
    expect(html).toContain("&lt;redesign&gt;");
    const plan = planImport(parseBookmarksHtml(html));
    expect(plan.pages).toEqual([
      {
        name: "Work & Clients",
        groups: [{ name: "Acme <redesign>", links: [{ url: "https://acme.example.com/brief?a=1&b=2", title: 'Acme "brief"' }] }],
      },
    ]);
  });

  it("names files by date and page", () => {
    expect(exportFileName("json")).toMatch(/^syncpads-\d{4}-\d{2}-\d{2}\.json$/);
    expect(exportFileName("html", "Work & Clients!")).toMatch(/^syncpads-work-clients-\d{4}-\d{2}-\d{2}\.html$/);
  });
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("export and import", () => {
  let dbMod: typeof import("@/db");
  let schema: typeof import("@/db/schema");
  let sp: typeof import("@/server/start-page");
  let plans: typeof import("@/server/plans");
  const alice = crypto.randomUUID();
  const bob = crypto.randomUUID();
  const freeUser = crypto.randomUUID();

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    dbMod = await import("@/db");
    schema = await import("@/db/schema");
    await (await import("@/db/migrate")).runMigrations();
    sp = await import("@/server/start-page");
    plans = await import("@/server/plans");
    await dbMod.db.insert(schema.users).values([
      { id: alice, email: `${alice}@test.local`, name: "A", plan: "pro" },
      { id: bob, email: `${bob}@test.local`, name: "B", plan: "pro" },
      { id: freeUser, email: `${freeUser}@test.local`, name: "F" },
    ]);
  });

  afterAll(async () => {
    await dbMod.pool.query("DELETE FROM users WHERE id IN (?, ?, ?)", [alice, bob, freeUser]);
    await dbMod.pool.end();
  });

  it("exports pages, groups, links and notes in order, leaving out trash", async () => {
    const res = await sp.importSyncPadsFile(alice, sample);
    const pageId = res.pageIds[0];
    const group = (await sp.getState(alice)).pages.find((p) => p.id === pageId)!.groups[0];
    const extra = await sp.createItem(alice, { groupId: group.id, type: "link", url: "https://trashed.example.com" });
    await sp.deleteItem(alice, extra.item.id);

    const file = await sp.exportPages(alice, pageId);
    expect(file.format).toBe("syncpads");
    expect(file.pages).toHaveLength(1);
    expect(file.pages[0]).toMatchObject({ name: "Work & Clients", layout: "3", hiddenFromAgents: true });
    expect(file.pages[0].groups[0]).toMatchObject({ name: "Acme <redesign>", layout: "tiles" });
    expect(file.pages[0].groups[0].items).toEqual([
      { type: "link", url: "https://acme.example.com/brief?a=1&b=2", title: 'Acme "brief"' },
      { type: "note", title: "Decisions", body: "<p>Use orange</p>" },
    ]);

    const all = await sp.exportPages(alice);
    expect(all.pages.map((p) => p.name)).toEqual(["Home", "Work & Clients"]);
    await expect(sp.exportPages(bob, pageId)).rejects.toBeInstanceOf(sp.NotFoundError);
  });

  it("imports an export into another account exactly, without touching existing pages", async () => {
    const file = parseSyncPadsFile(JSON.parse(JSON.stringify(await sp.exportPages(alice))));
    await sp.ensureUserSetup(bob);
    const res = await sp.importSyncPadsFile(bob, file);
    expect(res).toMatchObject({ pages: 2, links: 1, notes: 1, skipped: 0 });

    const state = await sp.getState(bob);
    expect(state.pages.map((p) => p.name)).toEqual(["Home", "Home", "Work & Clients"]);
    const copy = await sp.exportPages(bob);
    expect(copy.pages.slice(1)).toEqual(file.pages);
  });

  it("cleans unsafe note HTML and skips links that aren't web addresses", async () => {
    const res = await sp.importSyncPadsFile(bob, {
      format: "syncpads",
      version: 1,
      pages: [
        {
          name: "Unsafe",
          groups: [
            {
              name: "G",
              items: [
                { type: "note", title: "x", body: '<p>hi</p><script>alert(1)</script><img src=x onerror="alert(1)">' },
                { type: "link", url: "javascript:alert(1)" },
              ],
            },
          ],
        },
      ],
    });
    expect(res.skipped).toBe(1);
    const page = (await sp.exportPages(bob, res.pageIds[0])).pages[0];
    expect(page.groups[0].items).toHaveLength(1);
    const body = (page.groups[0].items[0] as { body: string }).body;
    expect(body).toContain("<p>hi</p>");
    expect(body).not.toMatch(/script|onerror/i);
  });

  it("keeps Free limits: no partial import when it would go over 3 pages", async () => {
    await sp.ensureUserSetup(freeUser);
    const threePages = { ...sample, pages: [sample.pages[0], sample.pages[0], sample.pages[0]] };
    await expect(sp.importSyncPadsFile(freeUser, threePages)).rejects.toBeInstanceOf(plans.PlanLimitError);
    expect((await sp.getState(freeUser)).pages).toHaveLength(1);
  });
});
