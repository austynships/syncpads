import Link from "next/link";
import { USERS_PAGE_SIZE, listUsers, userStats } from "@/server/admin";
import { readPeriod, requireAdmin } from "../guard";
import { Grid, PageHeader, PlanPill, Section, SignupChart, Stat, Table, ago, date, num, pct, td, windowOf } from "../ui";

export const metadata = { title: "Users" };

type Params = Promise<{ period?: string; q?: string; page?: string }>;

export default async function UsersPage({ searchParams }: { searchParams: Params }) {
  await requireAdmin();
  const params = await searchParams;
  const period = await readPeriod(searchParams);
  const q = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const [s, list] = await Promise.all([userStats(period), listUsers({ q, page })]);
  const w = windowOf(period);
  const pages = Math.max(1, Math.ceil(list.total / USERS_PAGE_SIZE));
  const link = (p: number) => `/admin/users?${new URLSearchParams({ period, ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <>
      <PageHeader title="Users" intro="Everyone who has signed up, and how they use SyncPads." path="/admin/users" period={period} />

      <Section title="Summary">
        <Grid>
          <Stat label="New users" value={num(s.new)} sub={w} highlight />
          <Stat label="Active users" value={num(s.active)} sub={`Used SyncPads in the ${w}`} highlight />
          <Stat label="Total users" value={num(s.total)} sub={`${num(s.verified)} verified · ${num(s.total - s.verified)} not verified`} />
          <Stat label="Pro / Free" value={`${num(s.pro)} / ${num(s.free)}`} sub={s.total ? `${pct(s.pro / s.total)} on Pro` : undefined} />
          <Stat label="Smart features on" value={num(s.smartFeatures)} sub="Summaries and search by meaning" />
          <Stat label="Notes" value={num(s.notes)} sub={`+${num(s.notesAdded)} in the ${w}`} />
        </Grid>
        <div className="mt-4">
          <SignupChart period={period} data={s.signups} />
        </div>
      </Section>

      <Section title={q ? `Users matching “${q}”` : "All users"} note={`${num(list.total)} ${list.total === 1 ? "user" : "users"}, newest first`}>
        <form action="/admin/users" className="mb-3 flex gap-2">
          <input type="hidden" name="period" value={period} />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by name or email"
            className="field max-w-sm py-2"
            aria-label="Search users"
          />
          <button type="submit" className="btn-secondary">
            Search
          </button>
          {q && (
            <Link href={`/admin/users?period=${period}`} className="btn-ghost">
              Clear
            </Link>
          )}
        </form>
        <Table head={["User", "Plan", "Links", "Pages", "Agents", "Last active", "Joined"]} empty={list.users.length === 0 && "No users found."}>
          {list.users.map((u) => (
            <tr key={u.id}>
              <td className={td}>
                <span className="font-medium text-slate-900">{u.name}</span>
                <span className="block text-xs text-slate-500">
                  {u.email}
                  {!u.verified && " · not verified"}
                </span>
              </td>
              <td className={td}>
                <PlanPill plan={u.plan} />
              </td>
              <td className={td}>{num(u.links)}</td>
              <td className={td}>{num(u.pages)}</td>
              <td className={td}>{num(u.agents)}</td>
              <td className={`${td} text-slate-500`}>{ago(u.lastActive)}</td>
              <td className={`${td} text-slate-500`}>{date(u.createdAt)}</td>
            </tr>
          ))}
        </Table>
        {pages > 1 && (
          <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
            <span>
              Page {page} of {pages}
            </span>
            <span className="flex gap-2">
              {page > 1 && (
                <Link href={link(page - 1)} className="btn-ghost">
                  Previous
                </Link>
              )}
              {page < pages && (
                <Link href={link(page + 1)} className="btn-ghost">
                  Next
                </Link>
              )}
            </span>
          </div>
        )}
      </Section>
    </>
  );
}
