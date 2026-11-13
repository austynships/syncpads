import { agentStats, listAgents } from "@/server/admin";
import { readPeriod, requireAdmin } from "../guard";
import { Card, Grid, PageHeader, PlanPill, Section, Stat, Table, ago, date, num, pct, td, windowOf } from "../ui";

export const metadata = { title: "Agent Connects" };

const ACCESS: Record<string, string> = {
  read: "Read only",
  read_add: "Read and add links",
  read_add_context: "Read, add links and save context",
};

const APP: Record<string, string> = { claude: "Claude", chatgpt: "ChatGPT", cursor: "Cursor", other: "Other" };

export default async function AgentsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  await requireAdmin();
  const period = await readPeriod(searchParams);
  const [s, connections] = await Promise.all([agentStats(period), listAgents()]);
  const w = windowOf(period);
  const maxTool = Math.max(1, ...s.byTool.map((t) => t.n));

  return (
    <>
      <PageHeader title="Agent Connects" intro="AI apps connected to SyncPads through MCP, and what they do." path="/admin/agents" period={period} />

      <Section title="Summary">
        <Grid>
          <Stat label="Users connected" value={num(s.usersConnected)} sub={`${num(s.connected)} connected agents`} />
          <Stat label="Agent connection rate" value={pct(s.connectionRate)} sub="Active users who used an agent (PRD target: 30%)" highlight />
          <Stat label="Agent requests" value={num(s.calls)} sub={`${num(s.usersActive)} users, ${w}`} highlight />
          <Stat label="Added or saved by agents" value={num(s.writes)} sub={w} highlight />
          <Stat label="New connections" value={num(s.newConnections)} sub={w} highlight />
          <Stat label="Inbox approval rate" value={pct(s.approvalRate)} sub={`${num(s.inboxWaiting)} waiting (PRD target: 60%)`} />
        </Grid>
      </Section>

      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Connected agents by app</p>
          {s.byClient.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No agents connected yet.</p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm">
              {s.byClient.map((c) => (
                <li key={c.client} className="flex justify-between">
                  <span className="font-medium text-slate-900">{APP[c.client] ?? c.client}</span>
                  <span className="text-slate-600">{num(c.n)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Requests by tool, {w}</p>
          {s.byTool.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No agent requests in the {w}.</p>
          ) : (
            <ul className="mt-4 space-y-2.5 text-sm">
              {s.byTool.map((t) => (
                <li key={t.action}>
                  <div className="flex justify-between">
                    <code className="font-mono text-[13px] text-slate-900">{t.action}</code>
                    <span className="text-slate-600">{num(t.n)}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                    <div className="h-1.5 rounded-full bg-slate-900" style={{ width: `${(t.n / maxTool) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Section title="All connections" note="Most recently used first; disconnected ones last">
        <Table head={["User", "App", "Access", "Inbox", "Last used", "Connected", "Status"]} empty={connections.length === 0 && "No agents connected yet."}>
          {connections.map((a) => (
            <tr key={a.id} className={a.revokedAt ? "text-slate-400" : undefined}>
              <td className={td}>
                <span className="block text-slate-900">{a.email}</span>
                <span className="mt-0.5 inline-block">
                  <PlanPill plan={a.plan} />
                </span>
              </td>
              <td className={td}>
                <span className="font-medium text-slate-900">{a.name}</span>
                <span className="block text-xs text-slate-500">{APP[a.client] ?? a.client}</span>
              </td>
              <td className={td}>{ACCESS[a.permission] ?? a.permission}</td>
              <td className={td}>{a.autoApprove ? "Skips inbox" : "Reviews in inbox"}</td>
              <td className={td}>{ago(a.lastUsedAt)}</td>
              <td className={td}>{date(a.createdAt)}</td>
              <td className={td}>
                {a.revokedAt ? (
                  <span className="text-xs">Disconnected {date(a.revokedAt)}</span>
                ) : (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">Connected</span>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </Section>
    </>
  );
}
