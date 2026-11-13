/** Building blocks for the documentation pages (/docs). */
import Link from "next/link";

export const DOCS_NAV = [
  { href: "/docs", title: "Overview" },
  { href: "/docs/connect", title: "Connect your AI" },
  { href: "/docs/tools", title: "Tools reference" },
  { href: "/docs/guides", title: "Get the most out of it" },
  { href: "/docs/control", title: "Control and privacy" },
  { href: "/docs/troubleshooting", title: "Troubleshooting" },
] as const;

export function DocTitle({ eyebrow, title, intro }: { eyebrow?: string; title: string; intro: React.ReactNode }) {
  return (
    <header className="mb-10">
      {eyebrow && <p className="text-sm font-semibold uppercase tracking-wider text-sync-600">{eyebrow}</p>}
      <h1 className="mt-2 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
      <div className="mt-4 text-lg leading-relaxed text-slate-600">{intro}</div>
    </header>
  );
}

/** A section with an anchor link. */
export function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="group mb-3 mt-12 scroll-mt-24 text-2xl font-bold tracking-tight text-slate-900">
      {children}
      <a href={`#${id}`} className="ml-2 text-slate-300 opacity-0 transition group-hover:opacity-100" aria-label="Link to this section">
        #
      </a>
    </h2>
  );
}

export function H3({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="mb-2 mt-8 scroll-mt-24 text-lg font-semibold text-slate-900">
      {children}
    </h3>
  );
}

/** Body text styles for docs prose. */
export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4 text-[15px] leading-relaxed text-slate-700 [&_a]:font-medium [&_a]:text-slate-900 [&_a]:underline [&_a]:decoration-sync-500 [&_a]:underline-offset-2 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[13px] [&_code]:text-slate-900 [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_strong]:font-semibold [&_strong]:text-slate-900 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
      {children}
    </div>
  );
}

export function CodeBlock({ title, children }: { title?: string; children: string }) {
  return (
    <figure className="overflow-hidden rounded-xl border border-slate-900/10 bg-slate-950">
      {title && <figcaption className="border-b border-white/10 px-4 py-2 text-xs font-medium text-slate-400">{title}</figcaption>}
      <pre className="overflow-x-auto px-4 py-3 text-[13px] leading-relaxed text-slate-100">
        <code>{children}</code>
      </pre>
    </figure>
  );
}

/** A prompt the user can say to their AI. */
export function Prompt({ children }: { children: React.ReactNode }) {
  return (
    <p className="w-fit max-w-full rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-2.5 text-[15px] font-medium text-slate-800">
      {children}
    </p>
  );
}

export function Callout({ tone = "info", title, children }: { tone?: "info" | "pro" | "warning"; title: string; children: React.ReactNode }) {
  const styles = {
    info: "border-blue-200 bg-blue-50/70",
    pro: "border-sync-200 bg-sync-50",
    warning: "border-amber-200 bg-amber-50",
  };
  return (
    <aside className={`rounded-xl border px-4 py-3 text-sm leading-relaxed text-slate-700 ${styles[tone]}`}>
      <p className="font-semibold text-slate-900">{title}</p>
      <div className="mt-1 [&_a]:font-medium [&_a]:text-slate-900 [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded [&_code]:bg-white/70 [&_code]:px-1">
        {children}
      </div>
    </aside>
  );
}

export function PlanBadge({ plan }: { plan: "free" | "pro" }) {
  return plan === "pro" ? (
    <span className="rounded-full bg-sync-600 px-2 py-0.5 text-[11px] font-bold text-white">Pro</span>
  ) : (
    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-700">Free and Pro</span>
  );
}

export function NextPage({ href, title }: { href: string; title: string }) {
  return (
    <div className="mt-16 border-t border-slate-900/[0.07] pt-6">
      <Link href={href} className="group inline-flex flex-col">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Next</span>
        <span className="mt-1 text-lg font-semibold text-slate-900 group-hover:text-sync-600">{title} →</span>
      </Link>
    </div>
  );
}
