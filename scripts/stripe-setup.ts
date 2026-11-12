/**
 * One-time Stripe setup for SyncPads Pro (SP-20). Safe to run again.
 *
 *  - Product "SyncPads Pro" with prices looked up by key:
 *      syncpads_pro_monthly  $5 / month
 *      syncpads_pro_yearly   $48 / year
 *  - Customer portal: update card, see invoices, switch monthly/yearly, cancel at period end
 *  - Webhook endpoint for <BETTER_AUTH_URL>/api/stripe/webhook
 *
 * Bundled to dist/stripe-setup.cjs and run inside the worker container:
 *   docker compose -f docker-compose.prod.yml exec -T worker node stripe-setup.cjs [--recreate-webhook]
 *
 * Progress goes to stderr. If a webhook endpoint is created, its signing secret
 * is the ONLY thing printed to stdout ("STRIPE_WEBHOOK_SECRET=whsec_..."), so
 * the caller can write it straight into .env without it being displayed.
 */
import Stripe from "stripe";

const log = (...args: unknown[]) => console.error("[stripe-setup]", ...args);

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  const origin = (process.env.BETTER_AUTH_URL ?? "").replace(/\/$/, "");
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  if (!origin.startsWith("https://")) throw new Error("BETTER_AUTH_URL must be the site's https:// address");
  const stripe = new Stripe(key);
  const mode = key.startsWith("sk_live_") || key.startsWith("rk_live_") ? "LIVE" : "TEST";
  log(`mode: ${mode}; site: ${origin}`);

  // ---------- product and prices ----------
  const wanted = [
    { lookup_key: "syncpads_pro_monthly", unit_amount: 500, interval: "month" as const, nickname: "Pro monthly" },
    { lookup_key: "syncpads_pro_yearly", unit_amount: 4800, interval: "year" as const, nickname: "Pro yearly" },
  ];
  const existing = await stripe.prices.list({ lookup_keys: wanted.map((w) => w.lookup_key), active: true, expand: ["data.product"] });
  let productId =
    existing.data.map((p) => (typeof p.product === "string" ? p.product : p.product.id)).find(Boolean) ?? null;
  if (!productId) {
    const product = await stripe.products.create({
      name: "SyncPads Pro",
      description: "Unlimited pages, links and AI agents that can add links and save context; summaries for every link; search by meaning.",
      metadata: { app: "syncpads" },
    });
    productId = product.id;
    log(`created product ${productId}`);
  }
  const priceIds: Record<string, string> = {};
  for (const w of wanted) {
    const found = existing.data.find((p) => p.lookup_key === w.lookup_key);
    if (found && found.unit_amount === w.unit_amount && found.recurring?.interval === w.interval) {
      priceIds[w.lookup_key] = found.id;
      log(`price ${w.lookup_key} exists (${found.id})`);
      continue;
    }
    const price = await stripe.prices.create({
      product: productId,
      currency: "usd",
      unit_amount: w.unit_amount,
      recurring: { interval: w.interval },
      lookup_key: w.lookup_key,
      transfer_lookup_key: true, // moves the key from an old price with a different amount
      nickname: w.nickname,
    });
    priceIds[w.lookup_key] = price.id;
    log(`created price ${w.lookup_key} (${price.id})`);
  }

  // ---------- customer portal ----------
  const portalSettings = {
    business_profile: {
      headline: "Manage your SyncPads Pro subscription",
      privacy_policy_url: `${origin}/privacy`,
      terms_of_service_url: `${origin}/terms`,
    },
    default_return_url: `${origin}/settings`,
    features: {
      customer_update: { enabled: true, allowed_updates: ["email" as const, "address" as const] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: "at_period_end" as const },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price" as const],
        proration_behavior: "create_prorations" as const,
        products: [{ product: productId, prices: Object.values(priceIds) }],
      },
    },
    metadata: { app: "syncpads" },
  };
  const configs = await stripe.billingPortal.configurations.list({ limit: 100 });
  const ours = configs.data.find((c) => c.metadata?.app === "syncpads");
  if (ours) {
    await stripe.billingPortal.configurations.update(ours.id, portalSettings);
    log(`updated portal configuration ${ours.id}`);
  } else {
    const created = await stripe.billingPortal.configurations.create({ ...portalSettings });
    log(`created portal configuration ${created.id}`);
  }

  // ---------- webhook ----------
  const url = `${origin}/api/stripe/webhook`;
  const events: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "customer.subscription.paused",
    "customer.subscription.resumed",
    "invoice.paid",
    "invoice.payment_failed",
  ];
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  const mine = endpoints.data.filter((e) => e.url === url);
  const recreate = process.argv.includes("--recreate-webhook");
  if (mine.length && !recreate) {
    for (const e of mine) await stripe.webhookEndpoints.update(e.id, { enabled_events: events, disabled: false });
    log(`webhook ${mine[0].id} exists for ${url} (kept; run with --recreate-webhook if STRIPE_WEBHOOK_SECRET is missing)`);
  } else {
    for (const e of mine) {
      await stripe.webhookEndpoints.del(e.id);
      log(`deleted old webhook ${e.id}`);
    }
    const created = await stripe.webhookEndpoints.create({ url, enabled_events: events, description: "SyncPads plans" });
    log(`created webhook ${created.id} for ${url}`);
    process.stdout.write(`STRIPE_WEBHOOK_SECRET=${created.secret}\n`);
  }
  log("done");
}

main().catch((err) => {
  log("failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
