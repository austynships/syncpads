/**
 * Notifications: sharing events, combined bursts, AI suggestions, admin
 * announcements and read state. The DB part runs when TEST_DATABASE_URL is set.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
// Set before anything imports "@/db".
if (url) process.env.DATABASE_URL = url;

const { describeCounts } = await import("@/server/notifications");

describe("describeCounts", () => {
  it("reads naturally", () => {
    expect(describeCounts({ links: 1 })).toBe("a link");
    expect(describeCounts({ links: 3, notes: 1 })).toBe("3 links and a note");
    expect(describeCounts({ notes: 2 })).toBe("2 notes");
    expect(describeCounts({})).toBe("something");
    expect(describeCounts({ widgets: 1 })).toBe("a widget");
    expect(describeCounts({ links: 2, notes: 1, widgets: 3 })).toBe("2 links, a note and 3 widgets");
  });
});

describe.skipIf(!url)("notifications", () => {
  let dbMod: typeof import("@/db");
  let schema: typeof import("@/db/schema");
  let sp: typeof import("@/server/start-page");
  let share: typeof import("@/server/share");
  let n: typeof import("@/server/notifications");
  const owner = crypto.randomUUID();
  const editor = crypto.randomUUID();
  const other = crypto.randomUUID();
  let pageId: string;
  let groupId: string;
  let token: string;

  const titles = async (userId: string) => (await n.listNotifications(userId)).items.filter((i) => i.type !== "announcement").map((i) => i.title);

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    dbMod = await import("@/db");
    schema = await import("@/db/schema");
    await (await import("@/db/migrate")).runMigrations();
    sp = await import("@/server/start-page");
    share = await import("@/server/share");
    n = await import("@/server/notifications");
    const longAgo = new Date(Date.now() - 86_400_000);
    await dbMod.db.insert(schema.users).values([
      { id: owner, email: `${owner}@test.local`, name: "Olivia Owner", plan: "pro", createdAt: longAgo },
      { id: editor, email: `${editor}@test.local`, name: "Eddie Editor", createdAt: longAgo },
      { id: other, email: `${other}@test.local`, name: "Pat", plan: "pro", createdAt: longAgo },
    ]);
    for (const id of [owner, editor, other]) await sp.ensureUserSetup(id);
    pageId = (await sp.createPage(owner, { name: "Team tools" })).id;
    groupId = (await sp.getState(owner)).pages.find((p) => p.id === pageId)!.groups[0].id;
  });

  afterAll(async () => {
    await dbMod.pool.query("DELETE FROM announcements WHERE created_by = ?", [owner]);
    await dbMod.pool.query("DELETE FROM users WHERE id IN (?, ?, ?)", [owner, editor, other]);
    await dbMod.pool.end();
  });

  it("stays quiet for pages nobody else is on", async () => {
    await sp.createItem(owner, { groupId, type: "link", url: "https://solo.example.com" });
    expect(await n.unreadCount(owner)).toBe(0);
  });

  it("tells the owner when someone joins", async () => {
    token = (await share.sharePage(owner, pageId, { role: "edit" })).share.token;
    await share.joinSharedPage(editor, token);
    expect(await titles(owner)).toEqual(["Eddie joined “Team tools” and can edit it"]);
    const [item] = (await n.listNotifications(owner)).items;
    expect(item).toMatchObject({ type: "page_joined", read: false, link: `/app?page=${pageId}` });
  });

  it("combines a burst of additions into one notification, and never notifies the person who did it", async () => {
    await sp.createItem(editor, { groupId, type: "link", url: "https://a.example.com" });
    await sp.createItem(editor, { groupId, type: "link", url: "https://b.example.com" });
    await sp.createItem(editor, { groupId, type: "note", noteBody: "<p>hi</p>" });
    expect((await titles(owner))[0]).toBe("Eddie added 2 links and a note to “Team tools”");
    expect(await titles(owner)).toHaveLength(2); // joined + one combined
    expect(await titles(editor)).toEqual([]);

    // The owner's additions go to the editor.
    await sp.createItem(owner, { groupId, type: "link", url: "https://c.example.com" });
    expect(await titles(editor)).toEqual(["Olivia added a link to “Team tools”"]);
  });

  it("tells others when someone adds a widget, combined with their other additions", async () => {
    const w = await import("@/server/widgets");
    await n.markRead(owner, "all");
    await w.createWidget(editor, { pageId, type: "clock", config: {} });
    expect((await titles(owner))[0]).toBe("Eddie added a widget to “Team tools”");
    await sp.createItem(editor, { groupId, type: "link", url: "https://e.example.com" });
    await w.createWidget(editor, { pageId, type: "todo", config: {} });
    expect((await titles(owner))[0]).toBe("Eddie added a link and 2 widgets to “Team tools”");
    expect(await n.unreadCount(owner)).toBe(1);
    // The person who added it isn't notified.
    expect((await titles(editor)).some((t) => t.includes("widget"))).toBe(false);
  });

  it("starts a new notification once the last one was read", async () => {
    await n.markRead(owner, "all");
    expect(await n.unreadCount(owner)).toBe(0);
    await sp.createItem(editor, { groupId, type: "link", url: "https://d.example.com" });
    const list = (await n.listNotifications(owner)).items;
    expect(list[0]).toMatchObject({ title: "Eddie added a link to “Team tools”", read: false });
    expect(list.filter((i) => i.title.startsWith("Eddie added"))).toHaveLength(3); // the burst before, the widget burst, and this new one
    await n.markRead(owner, [list[0].id]);
    expect(await n.unreadCount(owner)).toBe(0);
  });

  it("tells people when they lose a page, and the owner when someone leaves", async () => {
    await share.leaveSharedPage(editor, pageId);
    expect((await titles(owner))[0]).toBe("Eddie left “Team tools”");

    await share.joinSharedPage(editor, token);
    await share.removeEditor(owner, pageId, editor);
    expect((await titles(editor))[0]).toBe("Olivia removed you from “Team tools”");

    await share.joinSharedPage(editor, token);
    await share.sharePage(owner, pageId, { role: "view" });
    expect((await titles(editor))[0]).toBe("Olivia made “Team tools” view only");

    await share.sharePage(owner, pageId, { role: "edit" });
    await share.joinSharedPage(editor, token);
    await share.unsharePage(owner, pageId);
    expect((await titles(editor))[0]).toBe("Olivia stopped sharing “Team tools”");

    token = (await share.sharePage(owner, pageId, { role: "edit" })).share.token;
    await share.joinSharedPage(editor, token);
    await sp.deletePage(owner, pageId);
    const [deleted] = (await n.listNotifications(editor)).items;
    expect(deleted).toMatchObject({ type: "page_deleted", title: "Olivia deleted “Team tools”", link: null });
  });

  it("combines AI suggestions per AI", async () => {
    await n.notifyAgentSuggestion(dbMod.db, other, "Claude", { links: 1 });
    await n.notifyAgentSuggestion(dbMod.db, other, "Claude", { notes: 1 });
    await n.notifyAgentSuggestion(dbMod.db, other, "ChatGPT", { links: 1 });
    const list = (await n.listNotifications(other)).items.filter((i) => i.type === "agent_suggestion");
    expect(list.map((i) => i.title).sort()).toEqual([
      "ChatGPT suggested a link for your Agent Inbox",
      "Claude suggested a link and a note for your Agent Inbox",
    ]);
    expect(list[0]).toMatchObject({ link: "/app?inbox=1", body: null });
  });

  it("sends announcements to the right audience, tracks reads, and can retract them", async () => {
    await n.markRead(other, "all");
    await n.markRead(editor, "all");
    const { id } = await n.createAnnouncement(owner, { title: "New: notifications", body: "Check the bell.", link: "/docs", audience: "pro" });

    const proView = (await n.listNotifications(other)).items[0];
    expect(proView).toMatchObject({ id: `a_${id}`, type: "announcement", title: "New: notifications", body: "Check the bell.", read: false });
    expect(await n.unreadCount(other)).toBe(1);
    // Free users aren't in a Pro announcement.
    expect((await n.listNotifications(editor)).items.some((i) => i.id === `a_${id}`)).toBe(false);

    await n.markRead(other, [`a_${id}`]);
    expect(await n.unreadCount(other)).toBe(0);
    const sent = (await n.listAnnouncements()).find((a) => a.id === id)!;
    expect(sent.reads).toBe(1);
    expect(sent.reach).toBeGreaterThanOrEqual(2); // owner and other are Pro

    // People who sign up later don't get old announcements.
    const late = crypto.randomUUID();
    await dbMod.db.insert(schema.users).values({ id: late, email: `${late}@test.local`, name: "L", plan: "pro", createdAt: new Date(Date.now() + 60_000) });
    expect((await n.listNotifications(late)).items).toHaveLength(0);
    await dbMod.pool.query("DELETE FROM users WHERE id = ?", [late]);

    await n.deleteAnnouncement(id);
    expect((await n.listNotifications(other)).items.some((i) => i.id === `a_${id}`)).toBe(false);
  });
});
