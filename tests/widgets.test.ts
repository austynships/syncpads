/**
 * Widgets: settings validation, feed parsing, and the widgets data layer
 * (DB part runs when TEST_DATABASE_URL is set). Network calls are mocked.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url; // before anything imports "@/db"

// In-memory Redis.
vi.mock("@/lib/redis", () => {
  const store = new Map<string, string>();
  return {
    redis: {
      get: async (k: string) => store.get(k) ?? null,
      set: async (k: string, v: string) => (store.set(k, v), "OK"),
      del: async (k: string) => (store.delete(k) ? 1 : 0),
      incr: async () => 1,
      expire: async () => 1,
    },
  };
});

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>Example News</title>
  <item><title><![CDATA[First &amp; best]]></title><link>https://news.example.com/1</link><pubDate>Mon, 10 Nov 2026 10:00:00 GMT</pubDate></item>
  <item><title>Second</title><link>javascript:alert(1)</link></item>
  <item><title>Third</title><link>https://news.example.com/3</link></item>
</channel></rss>`;
const ATOM = `<feed xmlns="http://www.w3.org/2005/Atom"><title>Blog</title>
  <entry><title>Hello</title><link rel="alternate" href="https://blog.example.com/hello"/><updated>2026-11-01T00:00:00Z</updated></entry>
</feed>`;
const HTML = `<html><head><link rel="alternate" type="application/rss+xml" href="/feed.xml"></head><body>Site</body></html>`;

vi.mock("@/server/safe-fetch", () => ({
  safeFetch: async (target: string) => {
    const body = target.endsWith("/feed.xml") ? RSS : target.includes("site.example.com") ? HTML : target.includes("atom") ? ATOM : "nope";
    return { status: body === "nope" ? 404 : 200, contentType: "text/xml", body: Buffer.from(body), finalUrl: target };
  },
}));

const { parseWidgetConfig, describeWeather } = await import("@/lib/widgets");
const { parseFeed } = await import("@/server/widgets");

describe("widget settings", () => {
  it("validates each type", () => {
    expect(parseWidgetConfig("clock", { timeZone: "America/Detroit" })).toMatchObject({ timeZone: "America/Detroit" });
    expect(() => parseWidgetConfig("clock", { timeZone: "Mars/Olympus" })).toThrow(/time zone/);
    expect(() => parseWidgetConfig("countdown", { label: "Launch", date: "not a date" })).toThrow(/date/);
    expect(() => parseWidgetConfig("countdown", { label: "", date: "2026-12-01" })).toThrow(/counting down/);
    expect(() => parseWidgetConfig("rss", { feedUrl: "ftp://x" })).toThrow(/https/);
    expect(() => parseWidgetConfig("weather", { place: "", latitude: 0, longitude: 0 })).toThrow(/place/);
    expect(parseWidgetConfig("todo", {})).toEqual({ items: [] });
    expect(() => parseWidgetConfig("todo", { items: Array.from({ length: 51 }, (_, i) => ({ id: String(i), text: "x", done: false })) })).toThrow(/50/);
  });

  it("describes weather codes", () => {
    expect(describeWeather(0).text).toBe("Clear");
    expect(describeWeather(63).text).toBe("Rain");
    expect(describeWeather(95).emoji).toBe("⛈️");
  });
});

describe("parseFeed", () => {
  it("reads RSS, decoding text and dropping non-web links", () => {
    const feed = parseFeed(RSS);
    expect(feed.title).toBe("Example News");
    expect(feed.items).toEqual([
      { title: "First & best", url: "https://news.example.com/1", publishedAt: "2026-11-10T10:00:00.000Z" },
      { title: "Third", url: "https://news.example.com/3", publishedAt: null },
    ]);
  });

  it("reads Atom", () => {
    expect(parseFeed(ATOM)).toEqual({
      title: "Blog",
      items: [{ title: "Hello", url: "https://blog.example.com/hello", publishedAt: "2026-11-01T00:00:00.000Z" }],
    });
  });
});

describe.skipIf(!url)("widgets on pages", () => {
  let dbMod: typeof import("@/db");
  let schema: typeof import("@/db/schema");
  let sp: typeof import("@/server/start-page");
  let share: typeof import("@/server/share");
  let w: typeof import("@/server/widgets");
  const owner = crypto.randomUUID();
  const editor = crypto.randomUUID();
  const stranger = crypto.randomUUID();
  let pageId: string;

  const widgetsOf = async (userId: string) => (await sp.getState(userId)).pages.find((p) => p.id === pageId)?.widgets ?? [];

  beforeAll(async () => {
    dbMod = await import("@/db");
    schema = await import("@/db/schema");
    await (await import("@/db/migrate")).runMigrations();
    sp = await import("@/server/start-page");
    share = await import("@/server/share");
    w = await import("@/server/widgets");
    await dbMod.db.insert(schema.users).values([
      { id: owner, email: `${owner}@test.local`, name: "O", plan: "pro" },
      { id: editor, email: `${editor}@test.local`, name: "E" },
      { id: stranger, email: `${stranger}@test.local`, name: "S" },
    ]);
    for (const id of [owner, editor, stranger]) await sp.ensureUserSetup(id);
    pageId = (await sp.getState(owner)).pages[0].id;
  });

  afterAll(async () => {
    await dbMod.pool.query("DELETE FROM users WHERE id IN (?, ?, ?)", [owner, editor, stranger]);
    await dbMod.pool.end();
  });

  it("adds widgets to a page in order, and they come back with the page", async () => {
    const clock = await w.createWidget(owner, { pageId, type: "clock", config: { timeZone: "Europe/London" } });
    const todo = await w.createWidget(owner, { pageId, type: "todo", config: {} });
    expect(clock.widget.position).toBe(0);
    expect(todo.widget.position).toBe(1);
    expect((await widgetsOf(owner)).map((x) => x.type)).toEqual(["clock", "todo"]);

    await w.updateWidget(owner, todo.widget.id, { config: { items: [{ id: "a", text: "Ship it", done: false }] } });
    await w.reorderWidgets(owner, pageId, [todo.widget.id, clock.widget.id]);
    const list = await widgetsOf(owner);
    expect(list.map((x) => x.type)).toEqual(["todo", "clock"]);
    expect(list[0].config).toEqual({ items: [{ id: "a", text: "Ship it", done: false }] });
  });

  it("rejects bad settings and keeps a page to 12 widgets", async () => {
    await expect(w.createWidget(owner, { pageId, type: "countdown", config: { label: "x", date: "nope" } })).rejects.toThrow(/date/);
    for (let i = 0; i < 10; i++) await w.createWidget(owner, { pageId, type: "clock", config: {} });
    await expect(w.createWidget(owner, { pageId, type: "clock", config: {} })).rejects.toThrow(/up to 12/);
    for (const x of (await widgetsOf(owner)).slice(2)) await w.deleteWidget(owner, x.id);
    expect(await widgetsOf(owner)).toHaveLength(2);
  });

  it("lets editors of a shared page change widgets, and nobody else", async () => {
    const token = (await share.sharePage(owner, pageId, { role: "edit" })).share.token;
    await share.joinSharedPage(editor, token);
    const added = await w.createWidget(editor, { pageId, type: "countdown", config: { label: "Launch", date: "2027-01-15" } });
    expect((await widgetsOf(owner)).some((x) => x.id === added.widget.id)).toBe(true);

    await expect(w.createWidget(stranger, { pageId, type: "clock", config: {} })).rejects.toBeInstanceOf(sp.NotFoundError);
    await expect(w.deleteWidget(stranger, added.widget.id)).rejects.toBeInstanceOf(sp.NotFoundError);
    await expect(w.widgetData(stranger, added.widget.id)).rejects.toBeInstanceOf(sp.NotFoundError);
    await w.deleteWidget(editor, added.widget.id);
  });

  it("shows widgets on share links, to-do lists only with notes included, and serves their data through the link", async () => {
    const other = await sp.createPage(owner, { name: "Shared widgets" });
    const clock = await w.createWidget(owner, { pageId: other.id, type: "clock", config: {} });
    const todo = await w.createWidget(owner, { pageId: other.id, type: "todo", config: { items: [{ id: "x", text: "secret task", done: false }] } });
    const feedW = await w.createWidget(owner, { pageId: other.id, type: "rss", config: { feedUrl: "https://site.example.com/" } });
    const token = (await share.sharePage(owner, other.id, {})).share.token;

    let view = await share.getSharedPage(token);
    expect(view!.widgets.map((x) => x.type)).toEqual(["clock", "rss"]);
    expect(JSON.stringify(view)).not.toContain("secret task");

    await share.sharePage(owner, other.id, { includeNotes: true });
    view = await share.getSharedPage(token);
    expect(view!.widgets.map((x) => x.id)).toEqual([clock.widget.id, todo.widget.id, feedW.widget.id]);

    const data = (await share.sharedWidgetData(token, feedW.widget.id)) as import("@/lib/widgets").FeedData;
    expect(data.items.length).toBeGreaterThan(0);
    // Only weather and feed widgets on this shared page.
    await expect(share.sharedWidgetData(token, clock.widget.id)).rejects.toBeInstanceOf(sp.NotFoundError);
    const elsewhere = (await widgetsOf(owner)).find((x) => x.type === "rss");
    if (elsewhere) await expect(share.sharedWidgetData(token, elsewhere.id)).rejects.toBeInstanceOf(sp.NotFoundError);
    await share.unsharePage(owner, other.id);
    await expect(share.sharedWidgetData(token, feedW.widget.id)).rejects.toBeInstanceOf(sp.NotFoundError);
  });

  it("finds a site's feed, and serves its posts", async () => {
    const created = await w.createWidget(owner, { pageId, type: "rss", config: { feedUrl: "https://site.example.com/", limit: 5 } });
    expect((created.widget.config as { feedUrl: string }).feedUrl).toBe("https://site.example.com/feed.xml");
    const data = (await w.widgetData(owner, created.widget.id)) as import("@/lib/widgets").FeedData;
    expect(data.title).toBe("Example News");
    expect(data.items.map((i) => i.title)).toEqual(["First & best", "Third"]);

    await expect(w.createWidget(owner, { pageId, type: "rss", config: { feedUrl: "https://nothing.example.com/" } })).rejects.toThrow(/reach/);
  });
});
