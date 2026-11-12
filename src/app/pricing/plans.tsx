"use client";

import { useState } from "react";
import { useBillingRedirect } from "@/components/billing-buttons";
import { IconCheck } from "@/components/icons";

const FREE = [
  "Your start page on every device",
  "3 pages and 500 links",
  "Import from Chrome, Edge, Firefox, Safari or start.me",
  "1 connected AI agent (read only)",
  "Summaries for your first 100 links",
  "Keyword search",
];
const PRO = [
  "Unlimited pages and links",
  "Unlimited AI agents: Claude, ChatGPT, Cursor and more",
  "Agents can add links and save context from your chats",
  "Summaries and tags on every link",
  "Search by meaning",
  "10,000 agent requests a day",
];

export function Plans({
  signedIn,
  plan,
  available,
}: {
  signedIn: boolean;
  plan: "free" | "pro" | null;
  available: boolean;
}) {
  const [interval, setInterval] = useState<"month" | "year">("year");
  const { go, busy, error } = useBillingRedirect();

  const proCta = () => {
    if (!available) return <span className="btn-secondary w-full cursor-default py-3 opacity-70">Coming soon</span>;
    if (!signedIn) {
      return (
        <a href="/signup" className="btn-primary w-full py-3 text-base">
          Create your workspace
        </a>
      );
    }
    if (plan === "pro") {
      return (
        <button type="button" className="btn-secondary w-full py-3 text-base" disabled={busy !== null} onClick={() => go("portal")}>
          {busy ? "Opening…" : "Manage your plan"}
        </button>
      );
    }
    return (
      <button type="button" className="btn-primary w-full py-3 text-base" disabled={busy !== null} onClick={() => go(interval)}>
        {busy ? "Opening checkout…" : `Upgrade to Pro`}
      </button>
    );
  };

  return (
    <div>
      <div className="mx-auto flex w-fit gap-1 rounded-xl bg-slate-200/70 p-1" role="radiogroup" aria-label="Billing period">
        {(["month", "year"] as const).map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={interval === i}
            onClick={() => setInterval(i)}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
              interval === i ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {i === "month" ? "Monthly" : "Yearly"}
            {i === "year" && <span className="ml-1.5 rounded-full bg-sync-50 px-1.5 py-0.5 text-[11px] font-bold text-sync-700">Save 20%</span>}
          </button>
        ))}
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <article className="flex flex-col rounded-3xl border border-slate-900/[0.08] bg-white p-7 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Free</h2>
          <p className="mt-1 text-sm text-slate-600">A start page your AI can read.</p>
          <p className="mt-6 flex items-baseline gap-1">
            <span className="text-4xl font-bold tracking-tight text-slate-900">$0</span>
            <span className="text-sm text-slate-500">forever</span>
          </p>
          <ul className="mt-6 flex-1 space-y-3 text-sm text-slate-700">
            {FREE.map((f) => (
              <li key={f} className="flex gap-2.5">
                <IconCheck size={16} className="mt-0.5 text-slate-400" />
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-8">
            {signedIn ? (
              <span className="btn-secondary w-full cursor-default py-3 text-base opacity-80">
                {plan === "free" ? "Your current plan" : "Included"}
              </span>
            ) : (
              <a href="/signup" className="btn-secondary w-full py-3 text-base">
                Start free
              </a>
            )}
          </div>
        </article>

        <article className="relative flex flex-col rounded-3xl bg-slate-950 p-7 text-white shadow-2xl ring-1 ring-white/10">
          <span className="absolute -top-3 right-7 rounded-full bg-sync-600 px-3 py-1 text-xs font-bold">For people who work with AI</span>
          <h2 className="text-lg font-bold">Pro</h2>
          <p className="mt-1 text-sm text-slate-300">The place every AI you use goes to understand how you work.</p>
          <p className="mt-6 flex items-baseline gap-1">
            <span className="text-4xl font-bold tracking-tight">{interval === "month" ? "$5" : "$48"}</span>
            <span className="text-sm text-slate-400">{interval === "month" ? "per month" : "per year ($4 a month)"}</span>
          </p>
          <ul className="mt-6 flex-1 space-y-3 text-sm text-slate-200">
            {PRO.map((f) => (
              <li key={f} className="flex gap-2.5">
                <IconCheck size={16} className="mt-0.5 text-sync-400" />
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-8">{proCta()}</div>
          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
        </article>
      </div>
    </div>
  );
}
