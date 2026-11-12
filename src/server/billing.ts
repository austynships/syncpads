/**
 * Billing with Stripe (SP-20): Stripe Checkout to subscribe, the Stripe
 * customer portal to change plan, update the card, see invoices or cancel, and
 * webhooks to keep users.plan in step.
 *
 * Prices are found by lookup key, so no price IDs live in config:
 *   syncpads_pro_monthly ($5 / month), syncpads_pro_yearly ($48 / year).
 * `scripts/stripe-setup.ts` creates them (and the portal and webhook) once.
 *
 * Card details never touch SyncPads: Stripe collects them on its own pages.
 */
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions, users } from "@/db/schema";
import { ORIGIN } from "./oauth";

export const PRICE_LOOKUP = { month: "syncpads_pro_monthly", year: "syncpads_pro_yearly" } as const;
export type Interval = keyof typeof PRICE_LOOKUP;

/** Subscription states that keep Pro (past_due: Stripe is still retrying the card). */
const PRO_STATUSES = new Set(["active", "trialing", "past_due"]);

let client: Stripe | null = null;
export function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new BillingUnavailableError();
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

export function billingAvailable() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export class BillingUnavailableError extends Error {
  constructor() {
    super("Billing isn't set up on this server yet.");
  }
}

async function priceId(interval: Interval) {
  const prices = await stripe().prices.list({ lookup_keys: [PRICE_LOOKUP[interval]], active: true, limit: 1 });
  if (!prices.data[0]) throw new Error(`Stripe price "${PRICE_LOOKUP[interval]}" not found. Run the Stripe setup script.`);
  return prices.data[0].id;
}

/** The user's Stripe customer, created on first use. */
async function customerFor(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw new Error("User not found");
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customer = await stripe().customers.create(
    { email: user.email, name: user.name, metadata: { userId } },
    { idempotencyKey: `customer-${userId}` },
  );
  await db.update(users).set({ stripeCustomerId: customer.id }).where(eq(users.id, userId));
  return customer.id;
}

/** A Stripe Checkout page for Pro. Returns its URL. */
export async function createCheckout(userId: string, interval: Interval) {
  const [user] = await db.select({ plan: users.plan }).from(users).where(eq(users.id, userId));
  if (user?.plan === "pro") return { url: await createPortal(userId) }; // already Pro: manage instead
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: await customerFor(userId),
    client_reference_id: userId,
    line_items: [{ price: await priceId(interval), quantity: 1 }],
    subscription_data: { metadata: { userId } },
    allow_promotion_codes: true,
    success_url: `${ORIGIN}/settings?upgraded=1`,
    cancel_url: `${ORIGIN}/pricing`,
  });
  return { url: session.url! };
}

/** The Stripe customer portal (change plan, card, invoices, cancel). Returns its URL. */
export async function createPortal(userId: string) {
  const session = await stripe().billingPortal.sessions.create({
    customer: await customerFor(userId),
    return_url: `${ORIGIN}/settings`,
  });
  return session.url;
}

// ---------- webhooks ----------

/** Copies a Stripe subscription onto the user: plan, status, interval, renewal date. */
export async function syncSubscription(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const [byCustomer] = await db.select({ id: users.id }).from(users).where(eq(users.stripeCustomerId, customerId));
  const userId = byCustomer?.id ?? sub.metadata?.userId;
  if (!userId) {
    console.warn(`[billing] subscription ${sub.id}: no user for customer ${customerId}`);
    return null;
  }

  const item = sub.items.data[0];
  const interval = item?.price.recurring?.interval === "year" ? "year" : item?.price.recurring?.interval === "month" ? "month" : null;
  const periodEnd = item?.current_period_end ? new Date(item.current_period_end * 1000) : null;
  const pro = PRO_STATUSES.has(sub.status);

  await db.transaction(async (tx) => {
    const [current] = await tx.select().from(subscriptions).where(eq(subscriptions.userId, userId));
    // A user has one subscription row. If an old, ended subscription sends an
    // event after a newer one exists, ignore it.
    if (current && current.stripeSubscriptionId !== sub.id && !pro && PRO_STATUSES.has(current.status)) return;
    const values = {
      stripeSubscriptionId: sub.id,
      status: sub.status,
      interval,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    } as const;
    if (current) await tx.update(subscriptions).set(values).where(eq(subscriptions.userId, userId));
    else await tx.insert(subscriptions).values({ userId, ...values });
    await tx.update(users).set({ plan: pro ? "pro" : "free", stripeCustomerId: customerId }).where(eq(users.id, userId));
  });
  console.log(`[billing] ${sub.id} ${sub.status} -> user ${userId} is ${pro ? "pro" : "free"}`);
  return { userId, plan: pro ? ("pro" as const) : ("free" as const) };
}

const HANDLED = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.paid",
  "invoice.payment_failed",
]);

/** Handles one verified webhook event. Always re-reads the subscription from Stripe, so event order doesn't matter. */
export async function handleWebhookEvent(event: Stripe.Event) {
  if (!HANDLED.has(event.type)) return "ignored";
  const object = event.data.object as { id: string; object: string; subscription?: string | { id: string } | null; parent?: unknown };
  let subscriptionId: string | null = null;
  if (object.object === "subscription") subscriptionId = object.id;
  else if (object.object === "checkout.session" || object.object === "invoice") {
    const sub =
      object.subscription ??
      (object as { parent?: { subscription_details?: { subscription?: string | { id: string } } } }).parent?.subscription_details
        ?.subscription;
    subscriptionId = typeof sub === "string" ? sub : (sub?.id ?? null);
  }
  if (!subscriptionId) return "ignored";
  const sub = await stripe().subscriptions.retrieve(subscriptionId);
  await syncSubscription(sub);
  return "synced";
}

/** Verifies a webhook request's signature and returns the event. */
export function verifyWebhook(rawBody: string, signature: string | null) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signature) throw new Error("Missing webhook secret or signature");
  return stripe().webhooks.constructEvent(rawBody, signature, secret);
}

/** When someone deletes their account, end their subscription right away so they're never charged again. */
export async function cancelSubscriptionForDeletion(userId: string) {
  if (!billingAvailable()) return;
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
  if (!sub || !PRO_STATUSES.has(sub.status)) return;
  try {
    await stripe().subscriptions.cancel(sub.stripeSubscriptionId);
  } catch (err) {
    console.error(`[billing] couldn't cancel ${sub.stripeSubscriptionId} for deleted user ${userId}:`, err);
  }
}

export async function billingStatus(userId: string) {
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
  return sub
    ? {
        status: sub.status,
        interval: sub.interval,
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      }
    : null;
}
