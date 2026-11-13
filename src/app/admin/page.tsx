import Link from "next/link";
import { overviewStats } from "@/server/admin";
import { readPeriod, requireAdmin } from "./guard";
import { Grid, PageHeader, Section, SignupChart, Stat, num, pct, usd, windowOf } from "./ui";

export const metadata = { title: "Overview" };

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  await requireAdmin();
  const period = await readPeriod(searchParams);
  const s = await overviewStats(period);
  const w = windowOf(period);

  return (
    <>
      <PageHeader
        title="Overview"
        intro={`The ${w} at a glance. Updated ${s.generatedAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC.`}
        path="/admin"
        period={period}
      />

      <Section title="Money" note={s.revenue ? (s.revenue.livemode ? "Stripe, live mode, net of refunds" : "Stripe, TEST mode") : "Stripe unavailable"}>
        <Grid>
          <Stat label="Revenue" value={s.revenue ? usd(s.revenue.total) : "—"} sub={s.revenue ? `${num(s.revenue.charges)} payments, ${w}` : w} highlight />
          <Stat label="MRR" value={usd(s.subscriptions.mrrCents)} sub="Yearly plans counted as ÷ 12" />
          <Stat label="Paying subscribers" value={num(s.subscriptions.paying)} sub={`${s.subscriptions.monthly} monthly · ${s.subscriptions.yearly} yearly`} />
          <Stat
            label="At risk"
            value={num(s.subscriptions.cancelling + s.subscriptions.pastDue)}
            sub={`${s.subscriptions.cancelling} cancelling · ${s.subscriptions.pastDue} past due`}
          />
        </Grid>
      </Section>

      <Section title="Growth">
        <Grid>
          <Stat label="New users" value={num(s.users.new)} sub={`${num(s.users.total)} in total`} highlight />
          <Stat label="Active users" value={num(s.users.active)} sub={`Used SyncPads in the ${w}`} highlight />
          <Stat label="Links saved" value={num(s.content.links)} sub={`+${num(s.content.linksAdded)} in the ${w}`} />
          <Stat label="Pages created" value={num(s.content.pages)} sub={`+${num(s.content.pagesAdded)} in the ${w}`} />
        </Grid>
        <div className="mt-4">
          <SignupChart period={period} data={s.signups} />
        </div>
      </Section>

      <Section title="AI agents">
        <Grid>
          <Stat
            label="Agent connection rate"
            value={pct(s.mcp.connectionRate)}
            sub={`Active users who used an agent (PRD target: 30%)`}
            highlight
          />
          <Stat label="Users using agents" value={num(s.mcp.usersActive)} sub={w} highlight />
          <Stat label="Agent requests" value={num(s.mcp.calls)} sub={w} highlight />
        </Grid>
        <p className="mt-3 text-sm">
          <Link href={`/admin/agents?period=${period}`} className="font-semibold text-sync-600 hover:text-sync-700">
            See all agent connections →
          </Link>
        </p>
      </Section>
    </>
  );
}
