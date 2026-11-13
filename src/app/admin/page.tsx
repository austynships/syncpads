import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/brand";
import { IconArrowLeft } from "@/components/icons";
import { getSession } from "@/lib/session";
import { adminStats, isAdmin, isPeriod, type Period } from "@/server/admin";

export const metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const usd = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const num = (n: number) => n.toLocaleString("en-US");
const pct = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)}%`);

const TABS: { id: Period; label: string; window: string }[] = [
  { id: "day", label: "Day", window: "last 24 hours" },
  { id: "week", label: "Week", window: "last 7 days" },
  { id: "month", label: "Month", window: "last 30 days" },
];

// Admin dashboard. Anyone who isn't an admin gets a plain 404, so the page's
// existence isn't revealed. Read-only.
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ period?: string | string[] }> }) {
  const session = await getSession();
  if (!session || !isAdmin(session.user)) notFound();

  const requested = (await searchParams).period;
  const period: Period = isPeriod(requested) ? requested : "week";
  const tab = TABS.find((t) => t.id === period)!;
  const s = await adminStats(period);
  const maxSignups = Math.max(1, ...s.signups.map((d) => d.n));
  const signupsInPeriod = s.signups.reduce((sum, d) => sum + d.n, 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-900/5 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo height={26} href="/app" />
            <span className="rounded-md bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <PeriodToggle period={period} />
            <Link href="/app" className="btn-ghost hidden sm:inline-flex">
              <IconArrowLeft size={14} />
              Workspace
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Dashboard <span className="font-medium text-slate-400">· {tab.window}</span>
          </h1>
          <p className="text-xs text-slate-500">
            Updated {s.generatedAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC ·{" "}
            <Link href={`/admin?period=${period}`} className="font-semibold text-slate-700 hover:text-slate-900">
              Refresh
            </Link>
          </p>
        </div>

        <Section title="Revenue" note={s.revenue ? (s.revenue.livemode ? "From Stripe, live mode, net of refunds" : "From Stripe, TEST mode") : undefined}>
          {s.revenue ? (
            <Grid>
              <Stat label={`Revenue, ${tab.window}`} value={usd(s.revenue.total)} sub={`${num(s.revenue.charges)} payments`} highlight />
              <Stat label="MRR" value={usd(s.subscriptions.mrrCents)} sub="Yearly plans counted as ÷ 12" />
              <Stat label="Paying subscribers" value={num(s.subscriptions.paying)} sub={`${s.subscriptions.monthly} monthly · ${s.subscriptions.yearly} yearly`} />
              <Stat
                label="At risk"
                value={num(s.subscriptions.cancelling + s.subscriptions.pastDue)}
                sub={`${s.subscriptions.cancelling} cancelling · ${s.subscriptions.pastDue} past due`}
              />
              <Stat label="Stripe balance" value={usd(s.revenue.available)} sub={`${usd(s.revenue.pending)} pending`} />
            </Grid>
          ) : (
            <p className="rounded-xl bg-white p-5 text-sm text-slate-500 shadow-sm">Revenue is unavailable: Stripe isn&apos;t set up or couldn&apos;t be reached.</p>
          )}
        </Section>

        <Section title="Users">
          <Grid>
            <Stat label="New users" value={num(s.users.new)} sub={tab.window} highlight />
            <Stat label="Active users" value={num(s.users.active)} sub={`Used SyncPads in the ${tab.window}`} highlight />
            <Stat label="Total users" value={num(s.users.total)} sub={`${num(s.users.verified)} verified`} />
            <Stat label="Pro" value={num(s.users.pro)} sub={s.users.total ? `${pct(s.users.pro / s.users.total)} of users` : undefined} />
            <Stat label="Smart features on" value={num(s.users.smartFeatures)} />
          </Grid>
          <div className="mt-4 rounded-2xl border border-slate-900/[0.07] bg-white p-5 shadow-sm">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Sign-ups, {tab.window} {period === "day" ? "(by hour, UTC)" : "(by day)"}
              </p>
              <p className="text-xs text-slate-500">{num(signupsInPeriod)} total</p>
            </div>
            <div className="mt-4 flex h-28 items-end gap-1" role="img" aria-label={`Sign-ups in the ${tab.window}`}>
              {s.signups.map((d) => (
                <div key={d.key} className="group relative flex-1">
                  <div
                    className={`w-full rounded-t ${d.n ? "bg-slate-900" : "bg-slate-100"}`}
                    style={{ height: `${Math.max(4, (d.n / maxSignups) * 112)}px` }}
                  />
                  <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white group-hover:block">
                    {d.label}: {d.n}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-slate-400">
              <span>{s.signups[0]?.label}</span>
              <span>{s.signups[s.signups.length - 1]?.label}</span>
            </div>
          </div>
        </Section>

        <Section title="Content">
          <Grid>
            <Stat label="Links saved" value={num(s.content.links)} sub={`+${num(s.content.linksAdded)} in the ${tab.window}`} />
            <Stat label="Pages created" value={num(s.content.pages)} sub={`+${num(s.content.pagesAdded)} in the ${tab.window}`} />
            <Stat label="Notes" value={num(s.content.notes)} sub={`+${num(s.content.notesAdded)} in the ${tab.window}`} />
            <Stat label="Links per user" value={s.users.total ? (s.content.links / s.users.total).toFixed(1) : "—"} />
          </Grid>
        </Section>

        <Section title="AI agents (MCP)">
          <Grid>
            <Stat label="Users connected" value={num(s.mcp.usersConnected)} sub={`${num(s.mcp.activeAgents)} connected agents`} />
            <Stat
              label="Agent connection rate"
              value={pct(s.mcp.connectionRate)}
              sub={`Active users who used an agent in the ${tab.window} (PRD target: 30%)`}
              highlight
            />
            <Stat label="Agent requests" value={num(s.mcp.calls)} sub={tab.window} highlight />
            <Stat label="Added or saved by agents" value={num(s.mcp.writes)} sub={tab.window} highlight />
            <Stat label="Inbox approval rate" value={pct(s.mcp.approvalRate)} sub={`${num(s.mcp.inboxWaiting)} waiting (PRD target: 60%)`} />
            <Stat
              label="By app"
              value={s.mcp.byClient.length ? "" : "—"}
              sub={s.mcp.byClient.map((c) => `${c.client}: ${c.n}`).join(" · ") || undefined}
            />
          </Grid>
        </Section>

        <Section title="Newest users">
          <div className="overflow-x-auto rounded-2xl border border-slate-900/[0.07] bg-white shadow-sm">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">User</th>
                  <th className="px-4 py-2.5 font-semibold">Plan</th>
                  <th className="px-4 py-2.5 font-semibold">Links</th>
                  <th className="px-4 py-2.5 font-semibold">Agents</th>
                  <th className="px-4 py-2.5 font-semibold">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/[0.06] text-slate-700">
                {s.recentUsers.map((u) => (
                  <tr key={u.email}>
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-slate-900">{u.name}</span>
                      <span className="block text-xs text-slate-500">
                        {u.email}
                        {!u.verified && " · not verified"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${u.plan === "pro" ? "bg-sync-600 text-white" : "bg-slate-100 text-slate-700"}`}>
                        {u.plan === "pro" ? "Pro" : "Free"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">{num(u.links)}</td>
                    <td className="px-4 py-2.5">{num(u.agents)}</td>
                    <td className="px-4 py-2.5 text-slate-500">{u.createdAt.toLocaleDateString("en-US", { dateStyle: "medium" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </main>
    </div>
  );
}

function PeriodToggle({ period }: { period: Period }) {
  return (
    <nav aria-label="Time period" className="flex rounded-lg bg-slate-100 p-1 text-sm font-semibold">
      {TABS.map((t) => (
        <Link
          key={t.id}
          href={`/admin?period=${t.id}`}
          aria-current={t.id === period ? "page" : undefined}
          className={`rounded-md px-3 py-1 transition ${
            t.id === period ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        {note && <p className="text-xs text-slate-500">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}

/** `highlight` marks numbers that change with the Day/Week/Month toggle. */
function Stat({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border bg-white p-5 shadow-sm ${highlight ? "border-sync-500/30" : "border-slate-900/[0.07]"}`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      {value && <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p>}
      {sub && <p className="mt-1 text-xs leading-relaxed text-slate-500">{sub}</p>}
    </div>
  );
}
