import { handle } from "@/server/api";
import { createPortal } from "@/server/billing";

// Open the Stripe customer portal: change plan, update the card, see invoices, cancel.
export function POST(request: Request) {
  return handle(request, async ({ userId }) => ({ url: await createPortal(userId) }));
}
