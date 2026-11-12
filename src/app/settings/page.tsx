import Link from "next/link";
import { SessionKeepAlive } from "@/components/session-keep-alive";
import { requireSession } from "@/lib/session";
import { DeleteAccountForm } from "./delete-account-form";

export default async function SettingsPage() {
  const { user } = await requireSession();

  return (
    <main className="mx-auto max-w-lg p-6">
      <SessionKeepAlive />
      <Link href="/app" className="text-sm text-zinc-600 underline">
        ← Back
      </Link>
      <h1 className="mb-6 mt-4 text-2xl font-semibold">Settings</h1>

      <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="mb-1 font-semibold">Account</h2>
        <p className="text-sm text-zinc-700">{user.email}</p>
      </section>

      <section className="rounded-xl border border-red-200 bg-white p-6">
        <h2 className="mb-1 font-semibold text-red-700">Delete account</h2>
        <p className="mb-4 text-sm text-zinc-700">
          This permanently deletes your account and all of your pages, links, notes and connected
          agents right away. It can&apos;t be undone.
        </p>
        <DeleteAccountForm />
      </section>
    </main>
  );
}

