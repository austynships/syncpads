/**
 * Custom widgets: building with AI (Pro, daily limit; the model is mocked),
 * and the gallery (review before listing, copies on install, reports).
 * The DB part runs when TEST_DATABASE_URL is set.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url; // before anything imports "@/db"

vi.mock("@/lib/redis", () => {
  const store = new Map<string, number>();
  return {
    redis: {
      incr: async (k: string) => {
        store.set(k, (store.get(k) ?? 0) + 1);
        return store.get(k)!;
      },
      expire: async () => 1,
      get: async () => null,
      set: async () => "OK",
      del: async () => 1,
    },
  };
});

// The Claude API, mocked: records the request and returns a built widget.
const calls: Record<string, unknown>[] = [];
vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {
    status?: number;
  }
  class FakeAnthropic {
    static APIError = APIError;
    static RateLimitError = class extends APIError {};
    static APIConnectionError = class extends APIError {};
    beta = {
      messages: {
        parse: async (params: Record<string, unknown>) => {
          calls.push(params);
          return {
            stop_reason: "end_turn",
            parsed_output: { name: "Pomodoro timer", description: "A focus timer.", html: "<div id=t>25:00</div><script>syncpads.load()</script>" },
          };
        },
      },
    };
  }
  return { default: FakeAnthropic };
});

const { parseWidgetConfig } = await import("@/lib/widgets");

describe("custom widget settings", () => {
  it("limits code and saved data size", () => {
    expect(parseWidgetConfig("custom", { name: "X", html: "<p>x</p>", data: { n: 1 } })).toMatchObject({ name: "X" });
    expect(() => parseWidgetConfig("custom", { name: "X", html: "x".repeat(60_001) })).toThrow(/too big/);
    expect(() => parseWidgetConfig("custom", { name: "X", html: "<p>x</p>", data: "x".repeat(20_001) })).toThrow(/too much data/);
    expect(() => parseWidgetConfig("custom", { name: "", html: "<p>x</p>" })).toThrow();
  });
});

describe.skipIf(!url)("building widgets and the gallery", () => {
  let dbMod: typeof import("@/db");
  let schema: typeof import("@/db/schema");
  let sp: typeof import("@/server/start-page");
  let w: typeof import("@/server/widgets");
  let cw: typeof import("@/server/custom-widgets");
  let plans: typeof import("@/server/plans");
  let n: typeof import("@/server/notifications");
  const author = crypto.randomUUID();
  const freeUser = crypto.randomUUID();
  const reporters = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  const pageOf = async (id: string) => (await sp.getState(id)).pages[0];

  beforeAll(async () => {
    dbMod = await import("@/db");
    schema = await import("@/db/schema");
    await (await import("@/db/migrate")).runMigrations();
    sp = await import("@/server/start-page");
    w = await import("@/server/widgets");
    cw = await import("@/server/custom-widgets");
    plans = await import("@/server/plans");
    n = await import("@/server/notifications");
    await dbMod.db.insert(schema.users).values([
      { id: author, email: `${author}@test.local`, name: "Ada Author", plan: "pro" },
      { id: freeUser, email: `${freeUser}@test.local`, name: "F" },
      ...reporters.map((id) => ({ id, email: `${id}@test.local`, name: "R" })),
    ]);
    for (const id of [author, freeUser, ...reporters]) await sp.ensureUserSetup(id);
  });

  afterAll(async () => {
    await dbMod.pool.query("DELETE FROM users WHERE id IN (?, ?, ?, ?, ?)", [author, freeUser, ...reporters]);
    await dbMod.pool.end();
  });

  it("builds widgets with Claude for Pro users, with a safety fallback", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(cw.buildWidget(author, { prompt: "a timer" })).rejects.toThrow(/isn't available/);
    process.env.ANTHROPIC_API_KEY = "test-key";
    await expect(cw.buildWidget(freeUser, { prompt: "a timer" })).rejects.toBeInstanceOf(plans.PlanLimitError);
    expect(calls).toHaveLength(0); // Free users never reach the API

    const built = await cw.buildWidget(author, { prompt: "a pomodoro timer" });
    expect(built).toMatchObject({ name: "Pomodoro timer", description: "A focus timer." });
    expect(calls[0]).toMatchObject({ model: "claude-opus-5-5", fallbacks: "default", betas: ["server-side-fallback-2026-07-01"] });

    await cw.buildWidget(author, { prompt: "a pomodoro timer", currentHtml: built.html, change: "bigger numbers" });
    expect(String((calls[1].messages as { content: string }[])[0].content)).toContain("bigger numbers");
  });

  it("keeps people to a daily number of builds", async () => {
    for (let i = 2; i < cw.DAILY_BUILDS; i++) await cw.buildWidget(author, { prompt: "x widget" });
    await expect(cw.buildWidget(author, { prompt: "one more" })).rejects.toThrow(/today/);
  });

  it("reviews widgets before listing them, and installs copies", async () => {
    const page = await pageOf(author);
    const mine = await w.createWidget(author, { pageId: page.id, type: "custom", config: { name: "Pomodoro timer", html: "<p>v1</p>", prompt: "timer" } });
    const sent = await cw.publishWidget(author, mine.widget.id, { name: "Pomodoro timer", description: "A simple focus timer." });
    expect(sent.status).toBe("pending");
    expect((await cw.listGallery()).some((g) => g.id === sent.id)).toBe(false);

    await cw.reviewGalleryWidget(freeUser, sent.id, "publish"); // as an admin (not the author)
    const listed = (await cw.listGallery("pomodoro")).find((g) => g.id === sent.id);
    expect(listed).toMatchObject({ name: "Pomodoro timer", author: "Ada", installs: 0 });

    // Free users can add gallery widgets; they get their own copy.
    const freePage = await pageOf(freeUser);
    const installed = await cw.installGalleryWidget(freeUser, sent.id, freePage.id);
    expect(installed.widget.config).toMatchObject({ html: "<p>v1</p>", sourceGalleryId: sent.id });
    expect((await cw.listGallery()).find((g) => g.id === sent.id)!.installs).toBe(1);

    // The author changing their widget doesn't change the gallery or anyone's copy.
    await w.updateWidget(author, mine.widget.id, { config: { name: "Pomodoro timer", html: "<p>v2</p>" } });
    expect((await cw.listGallery()).find((g) => g.id === sent.id)!.html).toBe("<p>v1</p>");
    expect(((await pageOf(freeUser)).widgets.find((x) => x.id === installed.widget.id)!.config as { html: string }).html).toBe("<p>v1</p>");

    // Copies can't be republished, and only custom widgets can be.
    await expect(cw.publishWidget(freeUser, installed.widget.id, { name: "Mine now", description: "Stolen timer" })).rejects.toThrow(/came from the gallery/);
    const clock = await w.createWidget(author, { pageId: page.id, type: "clock", config: {} });
    await expect(cw.publishWidget(author, clock.widget.id, { name: "Clock", description: "A clock widget" })).rejects.toThrow(/Only custom/);
    await expect(cw.publishWidget(freeUser, mine.widget.id, { name: "x", description: "not mine" })).rejects.toBeInstanceOf(sp.NotFoundError);
  });

  it("sends a widget back to review after enough reports, and tells the author about decisions", async () => {
    const [g] = await cw.listGallery("pomodoro");
    for (const r of reporters) await cw.reportGalleryWidget(r, g.id, "looks broken");
    await cw.reportGalleryWidget(reporters[0], g.id, "again"); // one report per person
    expect((await cw.listGallery()).some((x) => x.id === g.id)).toBe(false);
    const queued = (await cw.listForReview()).find((x) => x.id === g.id)!;
    expect(queued).toMatchObject({ status: "pending", reports: 3 });
    expect(queued.reportReasons).toContain("looks broken");

    await cw.reviewGalleryWidget(freeUser, g.id, "remove", "Doesn't work");
    const titles = (await n.listNotifications(author)).items.map((i) => i.title);
    expect(titles).toContain("Your widget “Pomodoro timer” was removed from the gallery");
    expect(titles).toContain("Your widget “Pomodoro timer” is now in the gallery");
  });
});
