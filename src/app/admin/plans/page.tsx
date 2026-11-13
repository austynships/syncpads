import { listSubscriptions, planStats } from "@/server/admin";
import { readPeriod, requireAdmin } from "../guard";
import { Card, Grid, PageHeader, Section, Stat, Table, date, num, pct, td, usd, windowOf } from "../ui";

export const metadata = { title: "Plans" };

const STATUS: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-emerald-50 text-emerald-700" },
  trialing: { label: "Trial", className: "bg-emerald-50 text-emerald-700" },
  past_due: { label: "Past due", className: "bg-amber-50 text-amber-700" },
  canceled: { label: "Canceled", className: "bg-slate-100 text-slate-600" },
  unpaid: { label: "Unpaid", className: "bg-red-50 text-red-700" },
  incomplete: { label: "Incomplete", className: "bg-slate-100 text-slate-600" },
  incomplete_expired: { label: "Expired", className: "bg-slate-100 text-slate-600" },
};

const limit = (n: number) => (n === Infinity ? "Unlimited" : num(n));

export default async function PlansPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  await requireAdmin();
  const period = await readPeriod(searchParams);
  const [s, subs] = await Promise.all([planStats(period), listSubscriptions()]);
  const w = windowOf(period);
  const { free, pro } = s.limits;

  const rows: [string, string, string][] = [
    ["Price", "Free", `$${s.prices.month}/month or $${s.prices.year}/year`],
    ["Pages", limit(free.pages), limit(pro.pages)],
    ["Links", limit(free.links), limit(pro.links)],
    ["AI agents", `${limit(free.agents)}, read only`, `${limit(pro.agents)}, can add links and save context`],
    ["Summaries", `First ${num(free.summaries)} links`, "Every link"],
    ["Search", "Keywords", "Keywords and meaning"],
    ["Agent requests per day", num(free.agentCallsPerDay), num(pro.agentCallsPerDay)],
  ];

  return (
    <>
      <PageHeader title="Plans" intro="Subscriptions, revenue and what each plan includes." path="/admin/plans" period={period} />

      <Section title="Revenue" note={s.revenue ? (s.revenue.livemode ? "Stripe, live mode, net of refunds" : "Stripe, TEST mode") : undefined}>
        {s.revenue ? (
          <Grid>
            <Stat label="Revenue" value={usd(s.revenue.total)} sub={`${num(s.revenue.charges)} payments, ${w}`} highlight />
            <Stat label="MRR" value={usd(s.subscriptions.mrrCents)} sub={`${usd(s.subscriptions.mrrCents * 12)} a year at this rate`} />
            <Stat label="Stripe balance" value={usd(s.revenue.available)} sub={`${usd(s.revenue.pending)} pending`} />
            <Stat label="Subscription changes" value={num(s.subscriptionChanges)} sub={`New, renewed or canceled, ${w}`} highlight />
          </Grid>
        ) : (
          <Card className="p-5 text-sm text-slate-500">Revenue is unavailable: Stripe isn&apos;t set up or couldn&apos;t be reached.</Card>
        )}
      </Section>

      <Section title="Subscribers">
        <Grid>
          <Stat label="Paying subscribers" value={num(s.subscriptions.paying)} sub={`${s.subscriptions.monthly} monthly · ${s.subscriptions.yearly} yearly`} />
          <Stat label="On Pro" value={num(s.users.pro)} sub={`Includes accounts given Pro without paying`} />
          <Stat label="On Free" value={num(s.users.free)} sub={s.users.total ? `${pct(s.users.free / s.users.total)} of users` : undefined} />
          <Stat
            label="At risk"
            value={num(s.subscriptions.cancelling + s.subscriptions.pastDue)}
            sub={`${s.subscriptions.cancelling} cancelling · ${s.subscriptions.pastDue} past due`}
          />
        </Grid>
      </Section>

      <Section title="Subscriptions" note="Mirrored from Stripe, most recently changed first">
        <Table head={["Customer", "Status", "Billing", "Renews or ends", "Last change"]} empty={subs.length === 0 && "No subscriptions yet."}>
          {subs.map((sub) => {
            const st = STATUS[sub.status] ?? { label: sub.status, className: "bg-slate-100 text-slate-600" };
            return (
              <tr key={sub.email}>
                <td className={td}>
                  <span className="font-medium text-slate-900">{sub.name}</span>
                  <span className="block text-xs text-slate-500">{sub.email}</span>
                </td>
                <td className={td}>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${st.className}`}>{st.label}</span>
                  {sub.cancelAtPeriodEnd && <span className="ml-2 text-xs text-amber-700">Cancelling</span>}
                </td>
                <td className={td}>
                  {sub.interval === "year" ? `Yearly, $${s.prices.year}` : sub.interval === "month" ? `Monthly, $${s.prices.month}` : "—"}
                </td>
                <td className={td}>
                  {sub.cancelAtPeriodEnd ? "Ends " : ""}
                  {date(sub.currentPeriodEnd)}
                </td>
                <td className={`${td} text-slate-500`}>{date(sub.updatedAt)}</td>
              </tr>
            );
          })}
        </Table>
      </Section>

      <Section title="What each plan includes">
        <Table head={["", "Free", "Pro"]}>
          {rows.map(([label, f, p]) => (
            <tr key={label}>
              <td className={`${td} font-medium text-slate-900`}>{label}</td>
              <td className={td}>{f}</td>
              <td className={td}>{p}</td>
            </tr>
          ))}
        </Table>
        <p className="mt-2 text-xs text-slate-500">Limits and prices are set in the code (src/server/plans.ts) and in Stripe.</p>
      </Section>
    </>
  );
}
