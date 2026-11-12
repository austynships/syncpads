import Link from "next/link";
import { Logo } from "@/components/brand";
import { CookieSettingsLink } from "@/components/consent";
import { LEGAL } from "@/lib/legal";

/** Shared layout for the Privacy Policy and Terms of Service. */
export function LegalPage({ title, intro, children }: { title: string; intro: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-900/5 bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Logo height={26} href="/" />
          <nav className="flex gap-1 text-sm">
            <Link href="/privacy" className="btn-ghost">Privacy</Link>
            <Link href="/terms" className="btn-ghost">Terms</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">Effective {LEGAL.effectiveDate}</p>
        <div className="mt-6 text-base leading-relaxed text-slate-700">{intro}</div>
        <div className="mt-10 space-y-10">{children}</div>
      </main>
      <footer className="border-t border-slate-900/5 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-slate-500 sm:px-6">
          <span>© {new Date().getFullYear()} SyncPads</span>
          <span className="flex gap-4">
            <Link href="/privacy" className="hover:text-slate-900">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-900">Terms</Link>
            <CookieSettingsLink className="hover:text-slate-900" />
            <a href={`mailto:${LEGAL.contactEmail}`} className="hover:text-slate-900">Contact</a>
          </span>
        </div>
      </footer>
    </div>
  );
}

/** One numbered section. */
export function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-slate-700 [&_a]:font-medium [&_a]:text-slate-900 [&_a]:underline [&_a]:decoration-sync-500 [&_a]:underline-offset-2 [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-slate-900 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}
