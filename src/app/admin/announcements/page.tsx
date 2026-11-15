import { audienceSize, listAnnouncements } from "@/server/notifications";
import { requireAdmin } from "../guard";
import { PageHeader, Section, Table, date, num, pct, td } from "../ui";
import { Compose, Retract } from "./compose";

export const metadata = { title: "Announcements" };

const AUDIENCE = { all: "Everyone", free: "Free users", pro: "Pro users" } as const;

export default async function AnnouncementsPage() {
  await requireAdmin();
  const [sent, all, free, pro] = await Promise.all([listAnnouncements(), audienceSize("all"), audienceSize("free"), audienceSize("pro")]);

  return (
    <>
      <PageHeader
        title="Announcements"
        intro="Tell people about new features and news. It shows up in the notification bell in their SyncPads, marked “What's new”."
      />

      <Section title="New announcement">
        <Compose sizes={{ all, free, pro }} />
      </Section>

      <Section title="Sent" note="Retracting removes it from everyone's notifications">
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
