"use client";

import { BillingCard } from "./billing-card";
import { DeleteAccountForm } from "./delete-account-form";

/**
 * Account, plan and billing, and account deletion. Shown on /settings and in
 * the Account settings window in the app.
 */
export function AccountSettings({ name, email }: { name: string; email: string }) {
  return (
    <>
      <section className="rounded-2xl border border-slate-900/[0.07] bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <h2 className="font-semibold text-slate-900 dark:text-white">Account</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-[8rem_1fr]">
          <dt className="text-slate-500 dark:text-slate-400">Name</dt>
          <dd className="text-slate-900 dark:text-white">{name}</dd>
          <dt className="text-slate-500 dark:text-slate-400">Email</dt>
          <dd className="break-all text-slate-900 dark:text-white">{email}</dd>
        </dl>
      </section>

      <BillingCard />

      <section className="mt-6 rounded-2xl border border-red-200 bg-white p-6 shadow-sm dark:border-red-500/30 dark:bg-slate-900">
        <h2 className="font-semibold text-red-700 dark:text-red-400">Delete account</h2>
        <p className="mb-5 mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          This permanently deletes your account and all of your pages, links and notes right away, and ends any Pro
          subscription so you&apos;re not charged again. It can&apos;t be undone.
        </p>
        <DeleteAccountForm />
      </section>
    </>
  );
}
