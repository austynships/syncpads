/**
 * Start page data layer against a real MariaDB (runs when TEST_DATABASE_URL is set).
 * Focus: users can only touch their own data, revisions bump on every write,
 * and ordering/moving works.
 */
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("start page data", () => {
  let dbMod: typeof import("@/db");
  let sp: typeof import("@/server/start-page");
  let schema: typeof import("@/db/schema");
  const alice = crypto.randomUUID();
  const bob = crypto.randomUUID();

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    dbMod = await import("@/db");
    schema = await import("@/db/schema");
    await (await import("@/db/migrate")).runMigrations();
    sp = await import("@/server/start-page");
    for (const id of [alice, bob]) {
      await dbMod.db.insert(schema.users).values({ id, email: `${id}@test.local`, name: "T" });
    }
  });

  afterAll(async () => {
    await dbMod.pool.query("DELETE FROM users WHERE id IN (?, ?)", [alice, bob]);
    await dbMod.pool.end();
  });

  it("creates a Home page with a Favorites group for new users, only once", async () => {
    await Promise.all([sp.ensureUserSetup(alice), sp.ensureUserSetup(alice), sp.getState(alice)]);
    const state = await sp.getState(alice);
    expect(state.pages.map((p) => p.name)).toEqual(["Home"]);
    expect(state.pages[0].groups.map((g) => g.name)).toEqual(["Favorites"]);
    expect(state.settings).toMatchObject({ theme: "system", wallpaper: { type: "none" }, aiEnabled: false });
  });

  it("adds, edits, trashes and restores links; every write bumps the revision", async () => {
    const start = await sp.getRevision(alice);
    const groupId = (await sp.getState(alice)).pages[0].groups[0].id;

    const created = await sp.createItem(alice, { groupId, type: "link", url: "example.com", title: " Example " });
    expect(created.revision).toBe(start + 1);
    expect(created.item.url).toBe("https://example.com/");
    expect(created.item.title).toBe("Example");

    const updated = await sp.updateItem(alice, created.item.id, { title: "Renamed" });
    expect(updated.item.title).toBe("Renamed");
    expect(updated.revision).toBe(start + 2);

    await sp.deleteItem(alice, created.item.id);
    expect((await sp.getState(alice)).pages[0].groups[0].items).toHaveLength(0);
    await sp.restoreItem(alice, created.item.id);
    expect((await sp.getState(alice)).pages[0].groups[0].items).toHaveLength(1);
    expect(await sp.getRevision(alice)).toBe(start + 4);
  });

  it("rejects unsafe links and sanitizes notes", async () => {
    const groupId = (await sp.getState(alice)).pages[0].groups[0].id;
    await expect(sp.createItem(alice, { groupId, type: "link", url: "javascript:alert(1)" })).rejects.toThrow(/valid web address/);
    const note = await sp.createItem(alice, { groupId, type: "note", noteBody: "<p>Hi<script>x()</script></p>" });
    expect(note.item.noteBody).toBe("<p>Hi</p>");
  });

  it("never lets one user read or change another user's data", async () => {
    const aliceState = await sp.getState(alice);
    const page = aliceState.pages[0];
    const group = page.groups[0];
    const item = group.items[0];
    await sp.ensureUserSetup(bob);
    const bobGroup = (await sp.getState(bob)).pages[0].groups[0].id;

    await expect(sp.updatePage(bob, page.id, { name: "hacked" })).rejects.toThrow(/not found/);
    await expect(sp.deletePage(bob, page.id)).rejects.toThrow(/not found/);
    await expect(sp.updateGroup(bob, group.id, { name: "hacked" })).rejects.toThrow(/not found/);
    await expect(sp.deleteGroup(bob, group.id)).rejects.toThrow(/not found/);
    await expect(sp.createItem(bob, { groupId: group.id, type: "link", url: "evil.com" })).rejects.toThrow(/not found/);
    await expect(sp.updateItem(bob, item.id, { title: "hacked" })).rejects.toThrow(/not found/);
    await expect(sp.deleteItem(bob, item.id)).rejects.toThrow(/not found/);
    // Moving Alice's item into Bob's group must fail too.
    await expect(sp.reorderItems(bob, bobGroup, [item.id])).rejects.toThrow(/not found/);
    await expect(sp.reorderGroups(bob, (await sp.getState(bob)).pages[0].id, [group.id])).rejects.toThrow(/not found/);

    const after = await sp.getState(alice);
    expect(after.pages[0].name).toBe("Home");
    expect(after.pages[0].groups[0].items.map((i) => i.id)).toEqual(group.items.map((i) => i.id));
    expect(JSON.stringify(await sp.getState(bob))).not.toContain(item.id);
  });

  it("reorders pages, groups and items, and moves items between groups", async () => {
    const second = await sp.createPage(alice, { name: "Work" });
    let state = await sp.getState(alice);
    expect(state.pages.map((p) => p.name)).toEqual(["Home", "Work"]);
    await sp.reorderPages(alice, [second.id, state.pages[0].id]);
    state = await sp.getState(alice);
    expect(state.pages.map((p) => p.name)).toEqual(["Work", "Home"]);

    const home = state.pages[1];
    const g2 = await sp.createGroup(alice, { pageId: home.id, name: "Docs" });
    const g1 = home.groups[0];
    const ids = g1.items.map((i) => i.id);
    // Move the first item of Favorites into Docs.
    await sp.reorderItems(alice, g2.id, [ids[0]]);
    await sp.reorderItems(alice, g1.id, ids.slice(1));
    await sp.reorderGroups(alice, home.id, [g2.id, g1.id]);

    state = await sp.getState(alice);
    const homeNow = state.pages.find((p) => p.id === home.id)!;
    expect(homeNow.groups.map((g) => g.name)).toEqual(["Docs", "Favorites"]);
    expect(homeNow.groups[0].items.map((i) => i.id)).toEqual([ids[0]]);
    expect(homeNow.groups[1].items.map((i) => i.id)).toEqual(ids.slice(1));
  });

  it("won't delete the last page, and saves theme and wallpaper", async () => {
    await sp.ensureUserSetup(bob);
    const onlyPage = (await sp.getState(bob)).pages[0].id;
    await expect(sp.deletePage(bob, onlyPage)).rejects.toThrow(/at least one page/);

    await sp.updateSettings(bob, { theme: "dark", wallpaper: { type: "preset", value: "ocean" } });
    expect((await sp.getState(bob)).settings).toMatchObject({ theme: "dark", wallpaper: { type: "preset", value: "ocean" } });
  });

  it("saves a group of tabs in one write, skipping non-web addresses (SP-8)", async () => {
    const pageId = (await sp.getState(bob)).pages[0].id;
    const start = await sp.getRevision(bob);
    const result = await sp.createGroup(bob, {
      pageId,
      name: "Tabs",
      links: [
        { url: "https://one.example.com/", title: "One" },
        { url: "chrome://settings", title: "Settings" },
        { url: "https://two.example.com/", title: null },
      ],
    });
    expect(result).toMatchObject({ added: 2, skipped: 1, revision: start + 1 });
    const group = (await sp.getState(bob)).pages[0].groups.find((g) => g.id === result.id)!;
    expect(group.items.map((i) => [i.url, i.title, i.position])).toEqual([
      ["https://one.example.com/", "One", 0],
      ["https://two.example.com/", null, 1],
    ]);
    // Other users can't add a group to this page.
    await expect(sp.createGroup(alice, { pageId, name: "Nope", links: [] })).rejects.toThrow(/not found/);
  });

  it("imports bookmarks as new pages after the existing ones, in one write (SP-9)", async () => {
    // 2,002 links is over the Free limit (500): this test measures import speed, so use Pro.
    await dbMod.pool.query("UPDATE users SET plan = 'pro' WHERE id = ?", [bob]);
    const before = await sp.getState(bob);
    const folders = Array.from({ length: 20 }, (_, f) => ({
      title: `Folder ${f}`,
      children: Array.from({ length: 100 }, (_, i) => ({ title: `Link ${i}`, url: `https://s${f}-${i}.example.com/` })),
    }));
    const started = Date.now();
    const result = await sp.importBookmarks(bob, [
      { title: "Bookmarks bar", children: [{ title: "Top", url: "https://top.example.com" }, ...folders] },
      { title: "Loose", url: "https://loose.example.com" },
    ]);
    expect(Date.now() - started).toBeLessThan(120_000); // SP-9: 2,000 links in under 2 minutes
    expect(result).toMatchObject({ pages: 2, groups: 22, links: 2002, skipped: 0, revision: before.revision + 1 });

    const after = await sp.getState(bob);
    expect(after.pages.map((p) => p.name)).toEqual([...before.pages.map((p) => p.name), "Bookmarks bar", "Imported"]);
    const bar = after.pages.find((p) => p.id === result.pageIds[0])!;
    expect(bar.groups.map((g) => g.name).slice(0, 3)).toEqual(["Links", "Folder 0", "Folder 1"]);
    expect(bar.groups[1].items).toHaveLength(100);
    expect(bar.groups[1].items[99].title).toBe("Link 99");

    const [row] = await dbMod.db
      .select({ source: schema.items.source })
      .from(schema.items)
      .where(eqItem(bar.groups[0].items[0].id));
    expect(row.source).toBe("import");

    await expect(sp.importBookmarks(bob, [{ title: "Empty", children: [] }])).rejects.toThrow(/No links/);
  });
});

function eqItem(id: string) {
  return sql`id = ${id}`;
}

