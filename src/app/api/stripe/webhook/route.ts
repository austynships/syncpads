import { handleWebhookEvent, verifyWebhook } from "@/server/billing";

// Stripe webhooks (SP-20). Verified by signature, so no session or origin check.
export async function POST(request: Request) {
  const raw = await request.text();
  let event;
  try {
    event = verifyWebhook(raw, request.headers.get("stripe-signature"));
  } catch (err) {
    console.warn("[billing] rejected webhook:", (err as Error).message);
    return new Response("Invalid signature", { status: 400 });
  }
  try {
    const result = await handleWebhookEvent(event);
    return Response.json({ received: true, result });
  } catch (err) {
    // A 500 makes Stripe retry later.
    console.error(`[billing] webhook ${event.type} failed:`, err);
    return new Response("Webhook handling failed", { status: 500 });
  }
}
