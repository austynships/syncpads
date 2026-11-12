import Link from "next/link";
import { Logo } from "@/components/brand";
import { Clarity } from "@/components/clarity";
import { CookieSettingsLink } from "@/components/consent";
import { getSession } from "@/lib/session";
import { billingAvailable } from "@/server/billing";
import { getPlan } from "@/server/plans";
import { Plans } from "./plans";

export const metadata = {
  title: "Pricing",
  description: "SyncPads is free to start. Pro adds unlimited pages, links and AI agents that can add links and save context.",
};

const faqs = [
  {
    q: "Can I cancel any time?",
    a: "Yes. Cancel in Account settings and you keep Pro until the end of the period you've paid for. Then you're back on Free.",
  },
  {
    q: "What happens to my links if I go back to Free?",
    a: "Nothing is deleted. If you're over a Free limit, you just can't add more until you're under it again or upgrade. Agents go back to read only.",
  },
  {
    q: "Which AI apps work with SyncPads?",
    a: "Claude, ChatGPT, Cursor and any other app that supports MCP, the open standard for connecting AI tools.",
  },
  {
    q: "How do payments work?",
    a: "Payments are handled by Stripe. Your card details go straight to Stripe and never touch SyncPads. You can change your card or see invoices any time.",
  },
];

export default async function PricingPage() {
  const session = await getSession();
  const plan = session ? await getPlan(session.user.id) : null;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Clarity />
      <header className="border-b border-slate-900/5 bg-slate-50/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Logo href="/" height={30} />
          <nav className="flex items-center gap-1 sm:gap-2">
            {session ? (
              // Plain <a>: a full page load, so analytics on this public page doesn't follow into the app.
              <a href="/app" className="btn-primary">
                Open app
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

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-16 sm:px-6">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-sync-600">Pricing</p>
          <h1 className="mx-auto mt-3 max-w-2xl text-balance text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Start free. Upgrade when your AI relies on it.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">
            Organize your work on Free. Go Pro to let every AI you use add to it and remember what you decide.
          </p>
        </div>

        <div className="mt-12">
          <Plans signedIn={Boolean(session)} plan={plan} available={billingAvailable()} />
        </div>

        <section className="mx-auto mt-20 max-w-3xl">
          <h2 className="text-2xl font-bold text-slate-900">Questions</h2>
          <dl className="mt-6 divide-y divide-slate-900/[0.07] rounded-2xl border border-slate-900/[0.07] bg-white">
            {faqs.map((f) => (
              <div key={f.q} className="px-6 py-5">
                <dt className="font-semibold text-slate-900">{f.q}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-slate-600">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <footer className="border-t border-slate-900/5 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-slate-500 sm:px-6">
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
