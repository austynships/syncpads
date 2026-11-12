/**
 * Plans and billing (SP-20) against MariaDB (runs when TEST_DATABASE_URL is set):
 * Free limits, read-only agents on Free, Stripe webhook verification, and
 * syncing a subscription onto the user. Stripe's API itself isn't called.
 */
import { createHash } from "node:crypto";
import Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/redis", () => {
  const counters = new Map<string, number>();
  const incr = async (key: string) => {
    counters.set(key, (counters.get(key) ?? 0) + 1);
    return counters.get(key)!;
  };
  return {
    redis: {
      incr,
      expire: async () => 1,
      multi() {
        const ops: (() => Promise<unknown>)[] = [];
        const chain = {
          incr(key: string) {
            ops.push(() => incr(key));
            return chain;
          },
          expire() {
            ops.push(async () => 1);
            return chain;
          },
          async exec() {
            const out: [null, unknown][] = [];
            for (const op of ops) out.push([null, await op()]);
            return out;
          },
        };
        return chain;
      },
    },
  };
});

const url = process.env.TEST_DATABASE_URL;
const WEBHOOK_SECRET = "whsec_test_secret_for_signature_checks";

describe.skipIf(!url)("plans and billing", () => {
  let dbMod: typeof import("@/db");
  let schema: typeof import("@/db/schema");
  let sp: typeof import("@/server/start-page");
  let plans: typeof import("@/server/plans");
  let billing: typeof import("@/server/billing");
  let oauth: typeof import("@/server/oauth");
  let mcp: typeof import("@/app/mcp/route");
  let webhook: typeof import("@/app/api/stripe/webhook/route");
  const user = crypto.randomUUID();
  const clients: string[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy_key_for_tests";
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    dbMod = await import("@/db");
    schema = await import("@/db/schema");
    await (await import("@/db/migrate")).runMigrations();
    sp = await import("@/server/start-page");
    plans = await import("@/server/plans");
    billing = await import("@/server/billing");
    oauth = await import("@/server/oauth");
    mcp = await import("@/app/mcp/route");
    webhook = await import("@/app/api/stripe/webhook/route");
    await dbMod.db.insert(schema.users).values({ id: user, email: `${user}@test.local`, name: "T", stripeCustomerId: `cus_${user.slice(0, 8)}` });
    await sp.ensureUserSetup(user);
  });

  afterAll(async () => {
    await dbMod.pool.query("DELETE FROM users WHERE id = ?", [user]);
    for (const id of clients) await dbMod.pool.query("DELETE FROM oauth_clients WHERE id = ?", [id]);
    await dbMod.pool.end();
  });

  it("limits Free to 3 pages, with an upgrade prompt", async () => {
    await sp.createPage(user, { name: "Two" });
    await sp.createPage(user, { name: "Three" });
    await expect(sp.createPage(user, { name: "Four" })).rejects.toThrow(/Free includes 3 pages\. Upgrade to Pro/);
    await expect(sp.createPage(user, { name: "Four" })).rejects.toBeInstanceOf(plans.PlanLimitError);
    expect((await sp.getState(user)).pages).toHaveLength(3);
  });

  it("limits Free to 500 links across saves, imports and restores, without removing anything", async () => {
    const groupId = (await sp.getState(user)).pages[0].groups[0].id;
    const links = Array.from({ length: 499 }, (_, i) => ({ url: `https://l${i}.example.com/` }));
    // 499 links in one group (saved tabs), then one more by hand: exactly 500.
    await sp.createGroup(user, { pageId: (await sp.getState(user)).pages[0].id, name: "Bulk", links: links.slice(0, 450) });
    await sp.createGroup(user, { pageId: (await sp.getState(user)).pages[0].id, name: "Bulk 2", links: links.slice(450) });
    const last = await sp.createItem(user, { groupId, type: "link", url: "https://five-hundred.example.com" });
    expect(await plans.linkCount(user)).toBe(500);

    await expect(sp.createItem(user, { groupId, type: "link", url: "https://one-more.example.com" })).rejects.toThrow(
      /Free includes 500 links/,
    );
    // Notes aren't links: still allowed.
    await sp.createItem(user, { groupId, type: "note", noteBody: "<p>fine</p>" });
    // Imports that would go over are refused whole.
    await expect(
      sp.importBookmarks(user, [{ title: "More", children: [{ title: "x", url: "https://x.example.com" }] }]),
    ).rejects.toBeInstanceOf(plans.PlanLimitError);
    // Trash one, then restoring it is fine; but adding another first blocks the restore.
    await sp.deleteItem(user, last.item.id);
    await sp.createItem(user, { groupId, type: "link", url: "https://replacement.example.com" });
    await expect(sp.restoreItem(user, last.item.id)).rejects.toThrow(/500 links/);
    expect(await plans.linkCount(user)).toBe(500); // nothing removed
  });

  it("keeps Free agents read-only, one at a time", async () => {
    const verifier = "billing-test-verifier-0123456789abcdefghijklmnopq";
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const connect = async (name: string) => {
      const client = await oauth.registerClient({ client_name: name, redirect_uris: ["https://app.example.com/cb"] });
      clients.push(client.client_id);
      const check = await oauth.validateAuthorizeRequest(
        new URLSearchParams({ client_id: client.client_id, redirect_uri: "https://app.example.com/cb", response_type: "code", code_challenge: challenge, code_challenge_method: "S256" }),
      );
      if (!check.ok) throw new Error("bad request");
      expect(await plans.freeAgentConflict(user, { id: client.client_id, name })).toBe(name === "First" ? null : "First");
      const code = new URL(await oauth.approveAuthorization(user, check.request, "read")).searchParams.get("code")!;
      return (await oauth.exchangeCode({ id: client.client_id }, new URLSearchParams({ code, code_verifier: verifier }))).access_token;
    };
    const call = async (token: string, name: string, args: Record<string, unknown> = {}) => {
      const res = await mcp.POST(
        new Request("http://localhost:3000/mcp", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
        }),
      );
      return (await res.json()).result as { content: { text: string }[]; isError?: boolean };
    };

    const first = await connect("First");
    expect((await call(first, "list_pages")).isError).toBeFalsy();
    const add = await call(first, "add_link", { url: "https://example.com" });
    expect(add.isError).toBe(true);
    expect(add.content[0].text).toMatch(/On SyncPads Free, agents can search and read only/);

    // A second app (if it got connected while on Pro) pauses on Free.
    const second = await connect("Second");
    const blocked = await call(second, "list_pages");
    expect(blocked.isError).toBe(true);
    expect(blocked.content[0].text).toMatch(/Free includes 1 connected agent/);
  });

  it("rejects webhooks without a valid Stripe signature", async () => {
    const res = await webhook.POST(new Request("http://localhost:3000/api/stripe/webhook", { method: "POST", body: "{}", headers: { "stripe-signature": "t=1,v1=bad" } }));
    expect(res.status).toBe(400);
  });

  it("upgrades and downgrades the user from signed subscription webhooks", async () => {
    const period = Math.floor(Date.now() / 1000) + 30 * 86400;
    const fakeSub = (status: string, cancel = false) =>
      ({
        id: "sub_test_123",
        object: "subscription",
        customer: `cus_${user.slice(0, 8)}`,
        status,
        cancel_at_period_end: cancel,
        metadata: {},
        items: { data: [{ current_period_end: period, price: { recurring: { interval: "year" } } }] },
      }) as unknown as Stripe.Subscription;
    const retrieve = vi.spyOn(billing.stripe().subscriptions, "retrieve");

    const send = async (type: string, status: string, cancel = false) => {
      retrieve.mockResolvedValueOnce(fakeSub(status, cancel) as never);
      const payload = JSON.stringify({ id: `evt_${type}`, object: "event", type, data: { object: { id: "sub_test_123", object: "subscription" } } });
      const signature = billing.stripe().webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
      const res = await webhook.POST(new Request("http://localhost:3000/api/stripe/webhook", { method: "POST", body: payload, headers: { "stripe-signature": signature } }));
      expect(res.status).toBe(200);
    };

    await send("customer.subscription.created", "active");
    expect(await plans.getPlan(user)).toBe("pro");
    expect(await billing.billingStatus(user)).toMatchObject({ status: "active", interval: "year", cancelAtPeriodEnd: false });
    // Pro lifts the limits.
    await sp.createPage(user, { name: "Four" });

    await send("customer.subscription.updated", "active", true); // cancelled at period end: still Pro until then
    expect(await plans.getPlan(user)).toBe("pro");
    expect((await billing.billingStatus(user))?.cancelAtPeriodEnd).toBe(true);

    await send("customer.subscription.deleted", "canceled");
    expect(await plans.getPlan(user)).toBe("free");
    // Back on Free: nothing was removed, but new pages are blocked.
    expect((await sp.getState(user)).pages).toHaveLength(4);
    await expect(sp.createPage(user, { name: "Five" })).rejects.toBeInstanceOf(plans.PlanLimitError);
    retrieve.mockRestore();
  });
});
