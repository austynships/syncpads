import Link from "next/link";
import { Logo } from "@/components/brand";
import { IconArrowLeft } from "@/components/icons";
import { SessionKeepAlive } from "@/components/session-keep-alive";
import { requireSession } from "@/lib/session";
import { BillingCard } from "./billing-card";
import { DeleteAccountForm } from "./delete-account-form";

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

        <section className="mt-6 rounded-2xl border border-slate-900/[0.07] bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900">Account</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-[8rem_1fr]">
            <dt className="text-slate-500">Name</dt>
            <dd className="text-slate-900">{user.name}</dd>
            <dt className="text-slate-500">Email</dt>
            <dd className="text-slate-900">{user.email}</dd>
          </dl>
        </section>

        <BillingCard />

        <section className="mt-6 rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-red-700">Delete account</h2>
          <p className="mb-5 mt-1.5 text-sm leading-relaxed text-slate-600">
            This permanently deletes your account and all of your pages, links and notes right away, and ends any Pro
            subscription so you&apos;re not charged again. It can&apos;t be undone.
          </p>
          <DeleteAccountForm />
        </section>
      </main>
    </div>
  );
}
