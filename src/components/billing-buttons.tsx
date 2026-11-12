"use client";

import { useState } from "react";
import { api } from "@/components/start/api";

/** Starts Stripe Checkout for Pro, or opens the customer portal. Redirects the browser to Stripe. */
export function useBillingRedirect() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function go(kind: "month" | "year" | "portal") {
    setBusy(kind);
    setError(null);
    try {
      const { url } =
        kind === "portal"
          ? await api<{ url: string }>("POST", "/api/billing/portal")
          : await api<{ url: string }>("POST", "/api/billing/checkout", { interval: kind });
      window.location.href = url;
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }
  return { go, busy, error };
}
