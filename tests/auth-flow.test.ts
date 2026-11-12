/**
 * End-to-end auth flow through the real Better Auth handler and MariaDB.
 * Redis and email are replaced with in-memory fakes.
 * Runs only when TEST_DATABASE_URL is set (see README).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { fakeRedis } from "./helpers/fake-redis";

const url = process.env.TEST_DATABASE_URL;
const BASE = "http://localhost:3000";

const sent: { to: string; subject: string; text: string }[] = [];
const redisFake = fakeRedis();

vi.mock("@/lib/redis", () => ({ redis: redisFake.store }));
vi.mock("@/lib/email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email")>()),
  sendEmail: async (email: { to: string; subject: string; text: string }) => {
    sent.push(email);
  },
}));

describe.skipIf(!url)("auth flow", () => {
  let auth: typeof import("@/lib/auth").auth;
  let dbMod: typeof import("@/db");
  const email = `flow-${Date.now()}@test.local`;
  const password = "correct-horse-battery";

  function call(path: string, opts: { body?: unknown; ip?: string; cookie?: string; method?: string } = {}) {
    const headers = new Headers({ origin: BASE, "x-forwarded-for": opts.ip ?? "198.51.100.1" });
    if (opts.body) headers.set("content-type", "application/json");
    if (opts.cookie) headers.set("cookie", opts.cookie);
    return auth.handler(
      new Request(path.startsWith("http") ? path : `${BASE}/api/auth${path}`, {
        method: opts.method ?? (opts.body ? "POST" : "GET"),
        headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      }),
    );
  }

  const cookieFrom = (res: Response) =>
    res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const waitForEmail = async (subject: string) => {
    for (let i = 0; i < 50 && !sent.some((e) => e.subject.includes(subject)); i++) {
      await new Promise((r) => setTimeout(r, 20));
    }
    const found = sent.find((e) => e.subject.includes(subject));
    if (!found) throw new Error(`No "${subject}" email sent`);
    return found.text.match(/https?:\/\/\S+/)![0];
  };

  beforeAll(async () => {
    Object.assign(process.env, {
      DATABASE_URL: url,
      BETTER_AUTH_URL: BASE,
      BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-123",
      TRUST_PROXY: "true",
    });
    dbMod = await import("@/db");
    await (await import("@/db/migrate")).runMigrations();
    auth = (await import("@/lib/auth")).auth;
  });

  afterAll(async () => {
    await dbMod?.pool.end();
  });

  it("rejects passwords shorter than 8 characters", async () => {
    const res = await call("/sign-up/email", { body: { email, password: "short", name: "T" } });
    expect(res.status).toBe(400);
  });

  it("signs up, ignores client-sent plan, stores an Argon2id hash", async () => {
    const res = await call("/sign-up/email", { body: { email, password, name: "T", plan: "pro" } });
    expect(res.status).toBeLessThan(300);

    const [rows] = await dbMod.pool.query(
      "SELECT u.plan, u.email_verified AS verified, a.password FROM users u JOIN accounts a ON a.user_id = u.id WHERE u.email = ?",
      [email],
    );
    const row = (rows as { plan: string; verified: number; password: string }[])[0];
    expect(row.plan).toBe("free");
    expect(row.verified).toBe(0);
    expect(row.password.startsWith("$argon2id$")).toBe(true);
  });

  it("blocks sign-in until the email is verified", async () => {
    const res = await call("/sign-in/email", { body: { email, password } });
    expect(res.status).toBe(403);
  });

  it("verifies the email from the emailed link", async () => {
    const link = await waitForEmail("Verify");
    const res = await call(link);
    expect([200, 302]).toContain(res.status);
    const [rows] = await dbMod.pool.query("SELECT email_verified AS v FROM users WHERE email = ?", [email]);
    expect((rows as { v: number }[])[0].v).toBe(1);
  });

  it("locks after 5 failures for that email+IP, but not from another IP", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await call("/sign-in/email", { body: { email, password: "wrong-password" } });
      expect(res.status).toBe(401);
    }
    const locked = await call("/sign-in/email", { body: { email, password } });
    expect(locked.status).toBe(429);
    expect(await locked.text()).toContain("Try again in 15 minutes");

    const otherIp = await call("/sign-in/email", { body: { email, password }, ip: "198.51.100.2" });
    expect(otherIp.status).toBe(200);
  });

  it("counts unknown emails the same way", async () => {
    const res = await call("/sign-in/email", { body: { email: "nobody@test.local", password: "whatever1" } });
    expect(res.status).toBe(401);
  });

  it("issues a 30-day session, then deletes the account with the password", async () => {
    redisFake.advance(15 * 60); // let the lock expire
    const signIn = await call("/sign-in/email", { body: { email, password } });
    expect(signIn.status).toBe(200);
    const cookie = cookieFrom(signIn);

    const [sessions] = await dbMod.pool.query(
      "SELECT s.expires_at AS e FROM sessions s JOIN users u ON u.id = s.user_id WHERE u.email = ? ORDER BY s.created_at DESC LIMIT 1",
      [email],
    );
    const days = (new Date((sessions as { e: Date }[])[0].e).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);

    const wrong = await call("/delete-user", { body: { password: "wrong-password" }, cookie });
    expect(wrong.status).toBeGreaterThanOrEqual(400);

    const del = await call("/delete-user", { body: { password }, cookie });
    expect(del.status).toBe(200);
    const [users] = await dbMod.pool.query("SELECT COUNT(*) AS n FROM users WHERE email = ?", [email]);
    expect(Number((users as { n: number }[])[0].n)).toBe(0);
  });
});

