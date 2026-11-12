"use client";

import { useEffect, useState } from "react";
import { useBillingRedirect } from "@/components/billing-buttons";
import { IconCheck } from "@/components/icons";
import { api } from "@/components/start/api";

type Billing = {
  available: boolean;
  usage: {
    plan: "free" | "pro";
    pages: { used: number; limit: number | null };
    links: { used: number; limit: number | null };
    agents: { used: number; limit: number | null };
  };
  subscription: {
    status: string;
    interval: "month" | "year" | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
};

const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "";

/** Plan and billing (SP-20) in Account settings. */
export function BillingCard() {
  const [data, setData] = useState<Billing | null>(null);
  const [waiting, setWaiting] = useState(false);
  const { go, busy, error } = useBillingRedirect();

  useEffect(() => {
    const upgraded = new URLSearchParams(window.location.search).get("upgraded") === "1";
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      const b = await api<Billing>("GET", "/api/billing").catch(() => null);
      if (b) setData(b);
      // Just back from Stripe Checkout: the webhook can take a few seconds.
      if (upgraded && b?.usage.plan !== "pro" && tries++ < 15) {
        setWaiting(true);
        timer = setTimeout(load, 2000);
      } else {
        setWaiting(false);
      }
    };
    load();
    return () => clearTimeout(timer);
  }, []);

  if (!data) return <section className="mt-6 h-40 animate-pulse rounded-2xl bg-white shadow-sm" />;

  const { usage, subscription: sub } = data;
  const pro = usage.plan === "pro";
  const justUpgraded = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("upgraded") === "1";

  return (
    <section className="mt-6 rounded-2xl border border-slate-900/[0.07] bg-white p-6 shadow-sm">
      {justUpgraded && pro && (
        <p className="mb-5 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <IconCheck size={16} />
          Welcome to SyncPads Pro. Thank you for supporting SyncPads!
        </p>
      )}
      {waiting && (
        <p className="mb-5 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">Confirming your payment with Stripe…</p>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            Plan
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${pro ? "bg-sync-600 text-white" : "bg-slate-100 text-slate-700"}`}
            >
              {pro ? "Pro" : "Free"}
            </span>
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {pro && sub
              ? sub.cancelAtPeriodEnd
                ? `Pro until ${date(sub.currentPeriodEnd)}, then you'll move to Free. Nothing will be deleted.`
                : sub.status === "past_due"
                  ? "Your last payment didn't go through. Update your card to keep Pro."
                  : `${sub.interval === "year" ? "$48 a year" : "$5 a month"}, renews ${date(sub.currentPeriodEnd)}.`
              : "Free: 3 pages, 500 links and 1 read-only AI agent."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!data.available ? (
            <span className="text-sm text-slate-500">Upgrades are coming soon.</span>
          ) : pro || sub ? (
            <button type="button" className="btn-secondary" disabled={busy !== null} onClick={() => go("portal")}>
              {busy === "portal" ? "Opening…" : "Manage billing"}
            </button>
          ) : (
            <>
              <button type="button" className="btn-secondary" disabled={busy !== null} onClick={() => go("month")}>
                {busy === "month" ? "Opening…" : "$5 / month"}
              </button>
              <button type="button" className="btn-primary" disabled={busy !== null} onClick={() => go("year")}>
                {busy === "year" ? "Opening…" : "Upgrade: $48 / year"}
              </button>
            </>
          )}
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        <Meter label="Pages" {...usage.pages} />
        <Meter label="Links" {...usage.links} />
        <Meter label="AI agents" {...usage.agents} />
      </dl>
      {!pro && (
        <p className="mt-5 text-sm text-slate-600">
          Pro adds unlimited pages, links and agents, lets agents add links and save context, and turns on search by meaning.{" "}
          <a href="/pricing" className="font-semibold text-slate-900 underline decoration-sync-500 underline-offset-2">
            Compare plans
          </a>
        </p>
      )}
    </section>
  );
}

function Meter({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900">
        <span className="font-semibold">{used.toLocaleString()}</span>
        {limit ? <span className="text-slate-500"> of {limit.toLocaleString()}</span> : <span className="text-slate-500"> · unlimited</span>}
      </dd>
      {limit && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${pct >= 90 ? "bg-sync-600" : "bg-slate-900"}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}
