import Link from "next/link";
import { Logo } from "@/components/brand";
import { IconArrowLeft } from "@/components/icons";
import { SessionKeepAlive } from "@/components/session-keep-alive";
import { requireSession } from "@/lib/session";
import { AccountSettings } from "./account-settings";

export const metadata = { title: "Account settings" };

export default async function SettingsPage() {
  const { user } = await requireSession();

  return (
    <div className="min-h-screen bg-slate-50">
      <SessionKeepAlive />
      <header className="border-b border-slate-900/5 bg-white">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-4 sm:px-6">
          <Logo height={26} href="/app" />
          <Link href="/app" className="btn-ghost">
            <IconArrowLeft size={14} />
            Back to workspace
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Account settings</h1>

        <div className="mt-6">
          <AccountSettings name={user.name} email={user.email} />
        </div>
      </main>
    </div>
  );
}
