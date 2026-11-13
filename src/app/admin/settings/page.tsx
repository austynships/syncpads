import { settingsInfo } from "@/server/admin";
import { requireAdmin } from "../guard";
import { Card, PageHeader, Section } from "../ui";

export const metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  const session = await requireAdmin();
  const s = settingsInfo();

  return (
    <>
      <PageHeader title="Settings" intro="Who can see this dashboard, and which services are connected." />

      <Section title="Admins">
        <Card className="divide-y divide-slate-900/[0.06]">
          {s.admins.map((email) => (
            <div key={email} className="flex items-center justify-between px-5 py-3 text-sm">
              <span className="font-medium text-slate-900">{email}</span>
              {email === session.user.email.toLowerCase() && <span className="text-xs text-slate-500">You</span>}
            </div>
          ))}
        </Card>
        <p className="mt-2 text-sm text-slate-500">
          To add or remove an admin, edit <code className="font-mono text-[13px] text-slate-700">ADMIN_EMAILS</code> (comma separated) in the
          server&apos;s <code className="font-mono text-[13px] text-slate-700">.env</code>, then restart the app. Each admin must have a SyncPads
          account with a verified email.
        </p>
      </Section>

      <Section title="Services" note="Read from the server. Secret values are never shown.">
        <Card className="divide-y divide-slate-900/[0.06]">
          {s.services.map((svc) => (
            <div key={svc.name} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
              <span className="flex items-center gap-2.5 font-medium text-slate-900">
                <span className={`h-2 w-2 rounded-full ${svc.on ? "bg-emerald-500" : "bg-slate-300"}`} aria-hidden="true" />
                {svc.name}
              </span>
              <span className={svc.on ? "text-slate-600" : "text-slate-400"}>{svc.detail}</span>
            </div>
          ))}
        </Card>
      </Section>

      {s.appUrl && (
        <Section title="Site">
          <Card className="px-5 py-3 text-sm">
            <span className="text-slate-500">Address: </span>
            <span className="font-medium text-slate-900">{s.appUrl}</span>
          </Card>
        </Section>
      )}
    </>
  );
}
