import Link from "next/link";
import type { Period } from "@/server/admin";

export const usd = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
export const num = (n: number) => n.toLocaleString("en-US");
export const pct = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)}%`);
export const date = (d: Date | null | undefined) => (d ? d.toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" }) : "—");

/** Rough "3 hours ago" for last-used and last-active columns. */
export function ago(d: Date | null | undefined) {
  if (!d) return "Never";
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 2) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return date(d);
}

export const PERIOD_TABS: { id: Period; label: string; window: string }[] = [
  { id: "day", label: "Day", window: "last 24 hours" },
  { id: "week", label: "Week", window: "last 7 days" },
  { id: "month", label: "Month", window: "last 30 days" },
];
export const windowOf = (p: Period) => PERIOD_TABS.find((t) => t.id === p)!.window;

/** Page title, with the Day / Week / Month toggle when the page has time-based numbers. */
export function PageHeader({
  title,
  intro,
  path,
  period,
}: {
  title: string;
  intro?: string;
  path?: string;
  period?: Period;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {intro && <p className="mt-1 text-sm text-slate-500">{intro}</p>}
      </div>
      {path && period && (
        <nav aria-label="Time period" className="flex rounded-lg bg-white p-1 text-sm font-semibold shadow-sm ring-1 ring-slate-900/[0.07]">
          {PERIOD_TABS.map((t) => (
            <Link
              key={t.id}
              href={`${path}?period=${t.id}`}
              aria-current={t.id === period ? "page" : undefined}
              className={`rounded-md px-3 py-1 transition ${
                t.id === period ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

export function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 first:mt-0">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        {note && <p className="text-xs text-slate-500">{note}</p>}
      </div>
      {children}
    </section>
  );
}

export function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

/** `highlight` marks numbers that change with the Day / Week / Month toggle. */
export function Stat({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border bg-white p-5 shadow-sm ${highlight ? "border-sync-500/30" : "border-slate-900/[0.07]"}`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      {value && <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p>}
      {sub && <p className="mt-1 text-xs leading-relaxed text-slate-500">{sub}</p>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-900/[0.07] bg-white shadow-sm ${className}`}>{children}</div>;
}

export function SignupChart({ period, data }: { period: Period; data: { key: string; label: string; n: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.n));
  const total = data.reduce((s, d) => s + d.n, 0);
  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Sign-ups, {windowOf(period)} {period === "day" ? "(by hour, UTC)" : "(by day)"}
        </p>
        <p className="text-xs text-slate-500">{num(total)} total</p>
      </div>
      <div className="mt-4 flex h-28 items-end gap-1" role="img" aria-label={`Sign-ups in the ${windowOf(period)}: ${total}`}>
        {data.map((d) => (
          <div key={d.key} className="group relative flex-1">
            <div className={`w-full rounded-t ${d.n ? "bg-slate-900" : "bg-slate-100"}`} style={{ height: `${Math.max(4, (d.n / max) * 112)}px` }} />
            <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white group-hover:block">
              {d.label}: {d.n}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-slate-400">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </Card>
  );
}

export function PlanPill({ plan }: { plan: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${plan === "pro" ? "bg-sync-600 text-white" : "bg-slate-100 text-slate-700"}`}>
      {plan === "pro" ? "Pro" : "Free"}
    </span>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: string | false }) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-4 py-2.5 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-900/[0.06] text-slate-700">{children}</tbody>
      </table>
      {empty && <p className="px-4 py-8 text-center text-sm text-slate-500">{empty}</p>}
    </Card>
  );
}

export const td = "px-4 py-2.5";
