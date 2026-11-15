/**
 * Edit links: people who join a shared page can edit it from their own
 * workspace; the owner keeps control. Runs when TEST_DATABASE_URL is set.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("editing shared pages", () => {
  let dbMod: typeof import("@/db");
  let schema: typeof import("@/db/schema");
  let sp: typeof import("@/server/start-page");
  let share: typeof import("@/server/share");
  let search: typeof import("@/server/search");
  let agents: typeof import("@/server/agents");
  const owner = crypto.randomUUID();
  const editor = crypto.randomUUID();
  const stranger = crypto.randomUUID();
  let pageId: string;
  let groupId: string;
  let token: string;

  const pageOf = async (userId: string) => (await sp.getState(userId)).pages.find((p) => p.id === pageId);

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    dbMod = await import("@/db");
    schema = await import("@/db/schema");
    await (await import("@/db/migrate")).runMigrations();
    sp = await import("@/server/start-page");
    share = await import("@/server/share");
    search = await import("@/server/search");
    agents = await import("@/server/agents");
    await dbMod.db.insert(schema.users).values([
      { id: owner, email: `${owner}@test.local`, name: "Olivia Owner", plan: "pro" },
      { id: editor, email: `${editor}@test.local`, name: "Eddie Editor" },
      { id: stranger, email: `${stranger}@test.local`, name: "S" },
    ]);
    for (const id of [owner, editor, stranger]) await sp.ensureUserSetup(id);
    const created = await sp.createPage(owner, { name: "Team tools" });
    pageId = created.id;
    groupId = (await pageOf(owner))!.groups[0].id;
    await sp.createItem(owner, { groupId, type: "link", url: "https://linear.app" });
  });

  afterAll(async () => {
    await dbMod.pool.query("DELETE FROM users WHERE id IN (?, ?, ?)", [owner, editor, stranger]);
    await dbMod.pool.end();
  });

  it("only lets people join through an edit link", async () => {
    token = (await share.sharePage(owner, pageId, {})).share.token;
    await expect(share.joinSharedPage(editor, token)).rejects.toThrow(/view only/);
    const res = await share.sharePage(owner, pageId, { role: "edit" });
    expect(res.share).toMatchObject({ role: "edit", editors: 0, token });
    expect((await share.getSharedPage(token))!.role).toBe("edit");
  });

  it("adds the page to the editor's workspace as a tab", async () => {
    const before = await sp.getRevision(owner);
    const res = await share.joinSharedPage(editor, token);
    expect(res).toMatchObject({ pageId, joined: true });
    expect(await sp.getRevision(owner)).toBeGreaterThan(before); // the owner sees a new editor

    const page = await pageOf(editor);
    expect(page).toMatchObject({ name: "Team tools", access: "editor", ownerName: "Olivia" });
    expect(page!.groups[0].items.map((i) => i.url)).toEqual(["https://linear.app/"]);
    expect((await sp.getState(editor)).pages.at(-1)!.id).toBe(pageId); // after their own pages
    expect((await pageOf(owner))!.share).toMatchObject({ role: "edit", editors: 1 });
    expect(await share.listEditors(owner, pageId)).toMatchObject([{ userId: editor, name: "Eddie Editor" }]);

    // Joining twice changes nothing.
    expect(await share.joinSharedPage(editor, token)).toMatchObject({ joined: false });
  });

  it("lets editors change the page, and everyone sees it", async () => {
    const ownerRevision = await sp.getRevision(owner);
    const { item } = await sp.createItem(editor, { groupId, type: "note", noteBody: "<p>from Eddie</p>" });
    expect(await sp.getRevision(owner)).toBeGreaterThan(ownerRevision);
    expect((await pageOf(owner))!.groups[0].items.map((i) => i.id)).toContain(item.id);

    // The item belongs to the owner (their plan and smart features apply).
    const [row] = await dbMod.db.select({ userId: schema.items.userId }).from(schema.items).where(sp_eq(schema.items.id, item.id));
    expect(row.userId).toBe(owner);

    await sp.updateItem(editor, item.id, { noteBody: "<p>edited</p>" });
    await sp.updatePage(editor, pageId, { name: "Team tools (shared)", layout: "2" });
    const g = await sp.createGroup(editor, { pageId, name: "Docs" });
    await sp.updateGroup(editor, g.id, { name: "Docs and specs" });
    await sp.reorderGroups(editor, pageId, [g.id, groupId]);
    const ownerView = await pageOf(owner);
    expect(ownerView).toMatchObject({ name: "Team tools (shared)", layout: "2" });
    expect(ownerView!.groups.map((x) => x.name)).toEqual(["Docs and specs", "Links"]);

    await sp.deleteItem(editor, item.id);
    await sp.restoreItem(editor, item.id);
    await sp.deleteGroup(editor, g.id);
    expect((await pageOf(owner))!.groups).toHaveLength(1);
  });

  it("keeps owner-only controls with the owner", async () => {
    await expect(sp.updatePage(editor, pageId, { hiddenFromAgents: true })).rejects.toThrow(/owner/);
    await expect(sp.deletePage(editor, pageId)).rejects.toBeInstanceOf(sp.NotFoundError);
    await expect(share.sharePage(editor, pageId, { role: "view" })).rejects.toBeInstanceOf(sp.NotFoundError);
    await expect(share.unsharePage(editor, pageId)).rejects.toBeInstanceOf(sp.NotFoundError);
    await expect(share.listEditors(editor, pageId)).rejects.toBeInstanceOf(sp.NotFoundError);
    await expect(share.leaveSharedPage(owner, pageId)).rejects.toThrow(/own this page/);
  });

  it("doesn't let anyone else in, or move things between someone's own pages and a shared page", async () => {
    await expect(sp.createItem(stranger, { groupId, type: "link", url: "https://evil.example.com" })).rejects.toBeInstanceOf(sp.NotFoundError);
    await expect(sp.updatePage(stranger, pageId, { name: "x" })).rejects.toBeInstanceOf(sp.NotFoundError);

    const ownGroup = (await sp.getState(editor)).pages.find((p) => p.access === "owner")!.groups[0].id;
    const { item } = await sp.createItem(editor, { groupId: ownGroup, type: "link", url: "https://private.example.com" });
    await expect(sp.reorderItems(editor, groupId, [item.id])).rejects.toThrow(/can't move/);
    const shared = (await pageOf(editor))!.groups[0].items[0].id;
    await expect(sp.reorderItems(editor, ownGroup, [shared])).rejects.toThrow(/can't move/);
  });

  it("lets the editor order the shared tab among their own pages", async () => {
    const ids = (await sp.getState(editor)).pages.map((p) => p.id);
    await sp.reorderPages(editor, [pageId, ...ids.filter((id) => id !== pageId)]);
    expect((await sp.getState(editor)).pages[0].id).toBe(pageId);
  });

  it("includes the shared page in the editor's search and AI tools, but AIs can't write to it", async () => {
    const found = await search.search(editor, { query: "linear" });
    expect(found.results.map((r) => r.pageId)).toContain(pageId);
    expect((await search.search(stranger, { query: "linear" })).results).toHaveLength(0);

    const ctx = { userId: editor, agentId: crypto.randomUUID() };
    const visible = await agents.visiblePages(ctx);
    expect(visible.find((p) => p.id === pageId)).toMatchObject({ own: false });

    // The owner hiding the page from AI hides it from everyone's AI.
    await sp.updatePage(owner, pageId, { hiddenFromAgents: true });
    expect((await agents.visiblePages(ctx)).some((p) => p.id === pageId)).toBe(false);
    await sp.updatePage(owner, pageId, { hiddenFromAgents: false });
  });

  it("removes editors when the owner removes them, switches to view only, or stops sharing; editors can leave", async () => {
    await share.removeEditor(owner, pageId, editor);
    expect(await pageOf(editor)).toBeUndefined();

    await share.joinSharedPage(editor, token);
    await share.leaveSharedPage(editor, pageId);
    expect(await pageOf(editor)).toBeUndefined();

    await share.joinSharedPage(editor, token);
    await share.sharePage(owner, pageId, { role: "view" });
    expect(await pageOf(editor)).toBeUndefined();
    await expect(share.joinSharedPage(editor, token)).rejects.toThrow(/view only/);

    await share.sharePage(owner, pageId, { role: "edit" });
    await share.joinSharedPage(editor, token);
    await share.unsharePage(owner, pageId);
    expect(await pageOf(editor)).toBeUndefined();
    await expect(share.joinSharedPage(editor, token)).rejects.toBeInstanceOf(sp.NotFoundError);
  });

  it("removes the page for editors when the owner deletes it", async () => {
    token = (await share.sharePage(owner, pageId, { role: "edit" })).share.token;
    await share.joinSharedPage(editor, token);
    const before = await sp.getRevision(editor);
    await sp.deletePage(owner, pageId);
    expect(await pageOf(editor)).toBeUndefined();
    expect(await sp.getRevision(editor)).toBeGreaterThan(before);
  });
});

// eq without importing drizzle twice at the top (the DB module must load after DATABASE_URL is set).
function sp_eq(column: unknown, value: string) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { eq } = require("drizzle-orm") as typeof import("drizzle-orm");
  return eq(column as never, value);
}
