/**
 * Admin dashboard: who counts as an admin, and that the stats count real rows
 * (DB part runs when TEST_DATABASE_URL is set). Stripe isn't called.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/redis", () => ({ redis: { incr: async () => 1, expire: async () => 1 } }));

const url = process.env.TEST_DATABASE_URL;
// Set before anything imports "@/db" (the isAdmin tests load the admin module too).
if (url) process.env.DATABASE_URL = url;

describe("isAdmin", () => {
  const before = process.env.ADMIN_EMAILS;
  afterEach(() => {
    process.env.ADMIN_EMAILS = before;
  });

  it("needs a listed, verified email, ignoring case and spaces", async () => {
    const { isAdmin } = await import("@/server/admin");
    process.env.ADMIN_EMAILS = " Boss@Example.com , other@example.com";
    expect(isAdmin({ email: "boss@example.com", emailVerified: true })).toBe(true);
    expect(isAdmin({ email: "OTHER@example.com", emailVerified: true })).toBe(true);
    expect(isAdmin({ email: "boss@example.com", emailVerified: false })).toBe(false);
    expect(isAdmin({ email: "someone@example.com", emailVerified: true })).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });

  it("has no admins when ADMIN_EMAILS is empty", async () => {
    const { isAdmin } = await import("@/server/admin");
    process.env.ADMIN_EMAILS = "";
    expect(isAdmin({ email: "boss@example.com", emailVerified: true })).toBe(false);
  });
});

describe.skipIf(!url)("adminStats", () => {
  let dbMod: typeof import("@/db");
  let schema: typeof import("@/db/schema");
  let sp: typeof import("@/server/start-page");
  let admin: typeof import("@/server/admin");
  const user = crypto.randomUUID();

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    delete process.env.STRIPE_SECRET_KEY;
    dbMod = await import("@/db");
    schema = await import("@/db/schema");
    await (await import("@/db/migrate")).runMigrations();
    sp = await import("@/server/start-page");
    admin = await import("@/server/admin");
  });

  afterAll(async () => {
    await dbMod.pool.query("DELETE FROM users WHERE id = ?", [user]);
    await dbMod.pool.end();
  });

  it("counts new users, links and pages", async () => {
    const before = await admin.adminStats("day");
    await dbMod.db.insert(schema.users).values({ id: user, email: `${user}@test.local`, name: "Admin test" });
    await sp.ensureUserSetup(user);
    const state = await sp.getState(user);
    await sp.createItem(user, { groupId: state.pages[0].groups[0].id, type: "link", url: "https://admin-stats.example.com" });
    await sp.createPage(user, { name: "Second" });

    const after = await admin.adminStats("day");
    expect(after.users.total).toBe(before.users.total + 1);
    expect(after.users.new).toBe(before.users.new + 1);
    expect(after.content.linksAdded).toBe(before.content.linksAdded + 1);
    // One bar per hour for "day", and the new user lands in the last one.
    expect(after.signups).toHaveLength(24);
    expect(after.signups.at(-1)!.n).toBe(before.signups.at(-1)!.n + 1);
    expect((await admin.adminStats("month")).signups).toHaveLength(30);
    expect(after.content.links).toBe(before.content.links + 1);
    expect(after.content.pages - before.content.pages).toBeGreaterThanOrEqual(2);
    expect(after.recentUsers.some((u) => u.email === `${user}@test.local` && u.links === 1)).toBe(true);
    // No Stripe key: revenue is unavailable rather than an error.
    expect(after.revenue).toBeNull();
  });
});
