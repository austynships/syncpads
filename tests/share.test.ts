/**
 * Page sharing: share links, what visitors see, saving a copy, and turning
 * sharing off. The DB part runs when TEST_DATABASE_URL is set.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { safeNext } from "@/lib/safe-next";

describe("safeNext", () => {
  it("only follows paths on this site", () => {
    expect(safeNext("/s/abc")).toBe("/s/abc");
    expect(safeNext("/app?page=1")).toBe("/app?page=1");
    for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "evil.com", "", null, undefined]) {
      expect(safeNext(bad)).toBeNull();
    }
  });
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("page sharing", () => {
  let dbMod: typeof import("@/db");
  let schema: typeof import("@/db/schema");
  let sp: typeof import("@/server/start-page");
  let share: typeof import("@/server/share");
  const owner = crypto.randomUUID();
  const visitor = crypto.randomUUID();
  let pageId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    dbMod = await import("@/db");
    schema = await import("@/db/schema");
    await (await import("@/db/migrate")).runMigrations();
    sp = await import("@/server/start-page");
    share = await import("@/server/share");
    await dbMod.db.insert(schema.users).values([
      { id: owner, email: `${owner}@test.local`, name: "Austyn Example", plan: "pro" },
      { id: visitor, email: `${visitor}@test.local`, name: "V", plan: "pro" },
    ]);
    const res = await sp.importSyncPadsFile(owner, {
      format: "syncpads",
      version: 1,
      pages: [
        {
          name: "Design tools",
          layout: "3",
          groups: [
            {
              name: "Favorites",
              layout: "tiles",
              items: [
                { type: "link", url: "https://www.figma.com/", title: "Figma" },
                { type: "note", title: "Private", body: "<p>client budget is 40k</p>" },
              ],
            },
            { name: "Only notes", items: [{ type: "note", title: "n", body: "<p>x</p>" }] },
          ],
        },
      ],
    });
    pageId = res.pageIds[0];
    // Trash and inbox items must never be shared.
    const groupId = (await sp.getState(owner)).pages.find((p) => p.id === pageId)!.groups[0].id;
    const trashed = await sp.createItem(owner, { groupId, type: "link", url: "https://trashed.example.com" });
    await sp.deleteItem(owner, trashed.item.id);
    await dbMod.db.insert(schema.items).values({
      userId: owner,
      groupId,
      type: "link",
      url: "https://inbox.example.com",
      status: "inbox",
      source: "agent",
    });
  });

  afterAll(async () => {
    await dbMod.pool.query("DELETE FROM users WHERE id IN (?, ?)", [owner, visitor]);
    await dbMod.pool.end();
  });

  it("isn't shared until the owner turns it on, and only the owner can", async () => {
    expect((await sp.getState(owner)).pages.find((p) => p.id === pageId)!.share).toBeNull();
    await expect(share.sharePage(visitor, pageId, {})).rejects.toBeInstanceOf(sp.NotFoundError);
    await expect(share.unsharePage(visitor, pageId)).rejects.toBeInstanceOf(sp.NotFoundError);
  });

  it("shares links only by default: no notes, trash, inbox or owner details", async () => {
    const res = await share.sharePage(owner, pageId, {});
    expect(res.share).toMatchObject({ includeNotes: false, copies: 0 });
    expect(share.isShareToken(res.share.token)).toBe(true);
    expect((await sp.getState(owner)).pages.find((p) => p.id === pageId)!.share?.token).toBe(res.share.token);

    const view = await share.getSharedPage(res.share.token);
    expect(view).toMatchObject({ name: "Design tools", ownerName: "Austyn", layout: "3", links: 1, notes: 0 });
    // The notes-only group disappears; only the active link is left.
    expect(view!.groups).toEqual([
      { name: "Favorites", layout: "tiles", items: [{ type: "link", url: "https://www.figma.com/", title: "Figma", host: "figma.com" }] },
    ]);
    expect(JSON.stringify(view)).not.toMatch(/budget|trashed|inbox\.example|@test\.local/);

    // Sharing again keeps the same link.
    expect((await share.sharePage(owner, pageId, {})).share.token).toBe(res.share.token);
  });

  it("includes notes once the owner turns that on", async () => {
    const res = await share.sharePage(owner, pageId, { includeNotes: true });
    const view = await share.getSharedPage(res.share.token);
    expect(view).toMatchObject({ links: 1, notes: 2 });
    expect(JSON.stringify(view)).toContain("client budget");
  });

  it("saves a copy into the visitor's SyncPads and counts it", async () => {
    const token = (await share.sharePage(owner, pageId, {})).share.token;
    const res = await share.copySharedPage(visitor, token);
    expect(res).toMatchObject({ pages: 1, links: 1, notes: 2 });

    const copy = (await sp.exportPages(visitor, res.pageIds[0])).pages[0];
    expect(copy.name).toBe("Design tools");
    expect(copy.groups[0].items.map((i) => i.type)).toEqual(["link", "note"]);
    expect((await share.getSharedPage(token))!.copies).toBe(1);

    // The owner copying their own page doesn't count.
    await share.copySharedPage(owner, token);
    expect((await share.getSharedPage(token))!.copies).toBe(1);
  });

  it("serves favicons only for hosts on the shared page", async () => {
    const token = (await share.sharePage(owner, pageId, {})).share.token;
    expect(await share.sharedPageHasHost(token, "www.figma.com")).toBe(true);
    expect(await share.sharedPageHasHost(token, "trashed.example.com")).toBe(false);
    expect(await share.sharedPageHasHost(token, "evil.com")).toBe(false);
  });

  it("stops working when sharing is turned off; turning it on again makes a new link", async () => {
    const old = (await share.sharePage(owner, pageId, {})).share.token;
    await share.unsharePage(owner, pageId);
    expect(await share.getSharedPage(old)).toBeNull();
    await expect(share.copySharedPage(visitor, old)).rejects.toBeInstanceOf(sp.NotFoundError);

    const fresh = await share.sharePage(owner, pageId, {});
    expect(fresh.share.token).not.toBe(old);
    expect(fresh.share).toMatchObject({ includeNotes: false, copies: 0 });
  });

  it("rejects malformed tokens without a query", async () => {
    expect(await share.getSharedPage("x")).toBeNull();
    expect(await share.getSharedPage("../../etc/passwd-aaaaaaaaaaaaaaaaaa")).toBeNull();
  });
});
