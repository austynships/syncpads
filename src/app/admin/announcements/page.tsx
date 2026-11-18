import { audienceSize, listAnnouncements, listDirectMessages } from "@/server/notifications";
import { requireAdmin } from "../guard";
import { PageHeader, Section, Table, date, num, pct, td } from "../ui";
import { Compose, Retract } from "./compose";

export const metadata = { title: "Announcements" };

const AUDIENCE = { all: "Everyone", free: "Free users", pro: "Pro users" } as const;

export default async function AnnouncementsPage({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  await requireAdmin();
  const { to } = await searchParams;
  const [sent, direct, all, free, pro] = await Promise.all([
    listAnnouncements(),
    listDirectMessages(),
    audienceSize("all"),
    audienceSize("free"),
    audienceSize("pro"),
  ]);

  return (
    <>
      <PageHeader
        title="Announcements"
        intro="Tell everyone (or only Free or Pro users) about new features and news, or message specific people. It shows up in the notification bell in their SyncPads."
      />

      <Section title="New announcement">
        <Compose sizes={{ all, free, pro }} initialTo={typeof to === "string" ? to.slice(0, 2000) : ""} />
      </Section>

      {direct.length > 0 && (
        <Section title="Messages to specific people">
          <Table head={["Message", "Sent to", "Read", "Sent"]}>
            {direct.map((m, i) => (
              <tr key={i} className="align-top">
                <td className={td}>
                  <span className="font-medium text-slate-900">{m.title}</span>
                  {m.body && <span className="mt-0.5 block max-w-md text-xs leading-relaxed text-slate-500">{m.body}</span>}
                </td>
                <td className={td}>
                  {num(m.recipients)} {m.recipients === 1 ? "person" : "people"}
                  <span className="block max-w-xs truncate text-xs text-slate-500" title={m.emails}>
                    {m.emails}
                  </span>
                </td>
                <td className={td}>{num(m.readCount)}</td>
                <td className={`${td} text-slate-500`}>{date(m.sentAt)}</td>
              </tr>
            ))}
          </Table>
        </Section>
      )}

      <Section title="Sent announcements" note="Retracting removes it from everyone's notifications">
        <Table head={["Announcement", "Sent to", "Read", "Sent", ""]} empty={sent.length === 0 && "Nothing sent yet."}>
          {sent.map((a) => (
            <tr key={a.id} className="align-top">
              <td className={td}>
                <span className="font-medium text-slate-900">{a.title}</span>
                {a.body && <span className="mt-0.5 block max-w-md text-xs leading-relaxed text-slate-500">{a.body}</span>}
                {a.link && <span className="mt-0.5 block font-mono text-[11px] text-slate-400">{a.link}</span>}
              </td>
              <td className={td}>
                {AUDIENCE[a.audience]}
                <span className="block text-xs text-slate-500">{num(a.reach)} people</span>
              </td>
              <td className={td}>
                {num(a.reads)}
                <span className="block text-xs text-slate-500">{a.reach ? pct(a.reads / a.reach) : "—"}</span>
              </td>
              <td className={`${td} text-slate-500`}>{date(a.createdAt)}</td>
              <td className={`${td} text-right`}>
                <Retract id={a.id} title={a.title} />
              </td>
            </tr>
          ))}
        </Table>
      </Section>
    </>
  );
}
