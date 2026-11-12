import Link from "next/link";
import { Logo } from "@/components/brand";
import { IconArrowLeft } from "@/components/icons";
import { SessionKeepAlive } from "@/components/session-keep-alive";
import { requireSession } from "@/lib/session";
import { AgentsView } from "./agents-view";

export const metadata = { title: "Agents" };

// Connect an agent (SP-15), per-agent permissions (SP-18) and the activity log with undo (SP-17).
export default async function AgentsPage() {
  await requireSession();
  return (
    <div className="min-h-screen bg-slate-50">
      <SessionKeepAlive />
      <header className="border-b border-slate-900/5 bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Logo height={26} href="/app" />
          <Link href="/app" className="btn-ghost">
            <IconArrowLeft size={14} />
            Back to workspace
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Agents</h1>
        <p className="mt-1.5 text-sm text-slate-600">
          Let Claude, ChatGPT, Cursor and other AI tools search your saved links and suggest new ones. You decide what each
          one may do.
        </p>
        <AgentsView />
      </main>
    </div>
  );
}
