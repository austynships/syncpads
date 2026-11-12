import Link from "next/link";
import { redirect } from "next/navigation";
import { IconAlert, IconLink } from "@/components/icons";
import { AuthCard, StatusIcon, linkClass } from "@/components/ui";
import { getSession } from "@/lib/session";
import { validateAuthorizeRequest } from "@/server/oauth";

export const metadata = { title: "Connect an agent" };

// OAuth consent screen (SP-15). An agent (Claude, ChatGPT, Cursor...) sends the
// user here; they sign in if needed, choose what it may do, and allow or deny.
export default async function AuthorizePage({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) if (typeof v === "string") params.set(k, v);

  const check = await validateAuthorizeRequest(params);
  if (!check.ok && check.redirect) redirect(check.redirect);
  if (!check.ok) {
    return (
      <AuthCard
        icon={
          <StatusIcon tone="warning">
            <IconAlert size={22} />
          </StatusIcon>
        }
        title="Can't connect this app"
        subtitle={check.show}
        footer={
          <Link href="/app" className={linkClass}>
            Go to your workspace
          </Link>
        }
      />
    );
  }

  const session = await getSession();
  console.log(`[agents] consent screen for "${check.request.client.name}" (${session ? "signed in" : "sent to sign-in"})`);
  if (!session) redirect(`/login?next=${encodeURIComponent(`/oauth/authorize?${params.toString()}`)}`);

  const { client } = check.request;
  return (
    <AuthCard
      icon={
        <StatusIcon tone="brand">
          <IconLink size={22} />
        </StatusIcon>
      }
      title={`Connect ${client.name} to SyncPads`}
      subtitle={
        <>
          <strong className="text-slate-900">{client.name}</strong> wants to use your SyncPads workspace as{" "}
          <strong className="text-slate-900">{session.user.email}</strong>.
        </>
      }
      footer={<>You can change its access or disconnect it any time in Agents.</>}
    >
      <form method="post" action="/oauth/authorize/decision">
        {[...params.entries()].map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium text-slate-800">What can it do?</legend>
          <Choice
            value="read_add_context"
            defaultChecked
            title="Read, add links and save context"
            body="Search and read your pages, suggest links, and save decisions and summaries from your conversations. Everything waits in your Agent Inbox until you approve it."
          />
          <Choice
            value="read_add"
            title="Read and add links"
            body="Search and read your pages, and suggest links for your inbox. It can't save conversation context."
          />
          <Choice value="read" title="Read only" body="Search and read your pages. It can't add anything." />
        </fieldset>
        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          It can never delete anything, and pages you hide from agents stay invisible to it. Every action it takes is
          logged in Agents.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="submit" name="decision" value="deny" className="btn-secondary py-2.5">
            Deny
          </button>
          <button type="submit" name="decision" value="allow" className="btn-primary py-2.5">
            Allow
          </button>
        </div>
      </form>
    </AuthCard>
  );
}

function Choice({ value, title, body, defaultChecked }: { value: string; title: string; body: string; defaultChecked?: boolean }) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-xl border border-slate-900/10 bg-white p-3.5 has-[:checked]:border-sync-500 has-[:checked]:ring-4 has-[:checked]:ring-sync-500/10">
      <input type="radio" name="permission" value={value} defaultChecked={defaultChecked} className="mt-1 accent-sync-600" />
      <span>
        <span className="block text-sm font-semibold text-slate-900">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">{body}</span>
      </span>
    </label>
  );
}
