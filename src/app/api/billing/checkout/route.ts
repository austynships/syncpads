import { z } from "zod";
import { body, handle } from "@/server/api";
import { createCheckout } from "@/server/billing";

// Start a Stripe Checkout for Pro (SP-20). The client redirects to the returned URL.
export function POST(request: Request) {
  return handle(request, async ({ userId }) => {
    const { interval } = await body(request, z.object({ interval: z.enum(["month", "year"]) }));
    return createCheckout(userId, interval);
  });
}
