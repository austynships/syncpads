/**
 * Start page data layer against a real MariaDB (runs when TEST_DATABASE_URL is set).
 * Focus: users can only touch their own data, revisions bump on every write,
 * and ordering/moving works.
 */
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
    expect(state.settings).toEqual({ theme: "system", wallpaper: { type: "none" } });
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
    expect((await sp.getState(bob)).settings).toEqual({ theme: "dark", wallpaper: { type: "preset", value: "ocean" } });
  });
});

