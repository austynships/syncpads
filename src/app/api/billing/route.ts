import { handle } from "@/server/api";
import { billingAvailable, billingStatus } from "@/server/billing";
import { usage } from "@/server/plans";

// The plan, usage against Free limits, and subscription details for the signed-in user.
export function GET(request: Request) {
  return handle(request, async ({ userId }) => ({
    available: billingAvailable(),
    usage: await usage(userId),
    subscription: await billingStatus(userId),
  }));
}
