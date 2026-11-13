import Link from "next/link";
import { Logo } from "@/components/brand";
import { Clarity } from "@/components/clarity";
import { CookieSettingsLink } from "@/components/consent";
import { getSession } from "@/lib/session";
import { DocsNav } from "./docs-nav";

export const metadata = {
  title: { default: "Docs", template: "%s · SyncPads Docs" },
  description: "How to connect Claude, ChatGPT, Cursor and other AI tools to SyncPads, and get the most out of it.",
};

// Public documentation. Analytics only with consent (Clarity); links into the
// app are plain <a> tags so a recording can't follow the user in.
export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Clarity />
      <header className="sticky top-0 z-30 border-b border-slate-900/5 bg-slate-50/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo href="/" height={28} />
            <span className="hidden rounded-md bg-slate-900/5 px-2 py-0.5 text-xs font-semibold text-slate-600 sm:inline">Docs</span>
          </div>
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link href="/pricing" className="btn-ghost hidden sm:inline-flex">
              Pricing
            </Link>
            {session ? (
              <a href="/agents" className="btn-primary">
                Your agents
              </a>
            ) : (
              <>
                <Link href="/login" className="btn-ghost">
                  Sign in
                </Link>
                <Link href="/signup" className="btn-primary">
                  Get started
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[13rem_1fr] lg:py-14">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <DocsNav />
        </aside>
        <main className="min-w-0 max-w-3xl">{children}</main>
      </div>

      <footer className="border-t border-slate-900/5 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-slate-500 sm:px-6">
          <span>© {new Date().getFullYear()} SyncPads</span>
          <span className="flex gap-4">
            <Link href="/privacy" className="hover:text-slate-900">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-900">Terms</Link>
            <CookieSettingsLink className="hover:text-slate-900" />
          </span>
        </div>
      </footer>
    </div>
  );
}
