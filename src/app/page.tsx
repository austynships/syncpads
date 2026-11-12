import Link from "next/link";
import { Logo, LogoMark } from "@/components/brand";
import {
  IconArrowRight,
  IconBot,
  IconCheck,
  IconEyeOff,
  IconImport,
  IconInbox,
  IconLayers,
  IconLink,
  IconNote,
  IconPalette,
  IconShield,
  IconSync,
  IconUndo,
  IconX,
} from "@/components/icons";
import { getSession } from "@/lib/session";

/*
 * Positioning: SyncPads is the place your AI goes to understand how you work.
 * Every claim here describes something SyncPads does today (brand guide §7):
 * no promises about features that aren't built yet.
 */

const problems = [
  {
    title: "You re-explain your work in every chat",
    body: "The same docs, dashboards and client links, pasted again and again because your AI can't see where they live.",
  },
  {
    title: "Your AI guesses instead",
    body: "Without your sources it searches the web or makes things up, even when the right page is already in your bookmarks.",
  },
  {
    title: "Each AI starts from scratch",
    body: "Switch from Claude to ChatGPT to Cursor and the decisions you made in one don't come with you.",
  },
];

const steps = [
  {
    title: "Build your start page",
    body: "Import your bookmarks or paste links in. Group them into pages and add notes. It opens in every new tab, so it stays current without extra work.",
  },
  {
    title: "Connect your AI",
    body: "Copy one address into Claude, ChatGPT, Cursor or any app that supports MCP. Sign in and choose what it may do.",
  },
  {
    title: "Your AI works from your context",
    body: "Ask about a project, a client or a tool, and it reads your notes and finds your links. Say “save this to SyncPads” and the decisions and links from that chat are kept for every AI you use.",
  },
];

const audiences = [
  {
    icon: IconLayers,
    who: "Builders",
    ask: "“Check my SyncPads for our API docs before you write this.”",
    body: "Your repos, docs, dashboards and runbooks on one page, so your coding assistant works from your sources, not a web search.",
  },
  {
    icon: IconNote,
    who: "Freelancers and agencies",
    ask: "“What's on my Acme page?”",
    body: "One page per client with their briefs, dashboards and login pages. Your AI pulls the right client's links without you pasting them.",
  },
  {
    icon: IconLink,
    who: "Researchers and writers",
    ask: "“What have I saved about climate policy?”",
    body: "Sources collected by topic, with notes beside them. Your AI searches what you've already vetted before it looks anywhere else.",
  },
];

const controls = [
  {
    icon: IconInbox,
    title: "You approve every addition",
    body: "Links and conversation notes your AI saves wait in your Agent Inbox, with its reason, until you approve or dismiss them. Anything that looks like a password or key is removed first.",
  },
  {
    icon: IconEyeOff,
    title: "You set the limits",
    body: "Read only or read and add, chosen pages only. Pages you hide stay invisible to every AI, and none can delete anything.",
  },
  {
    icon: IconUndo,
    title: "Every action on record",
    body: "See what each assistant searched, read and added. Undo what it added, or disconnect it in one click.",
  },
  {
    icon: IconShield,
    title: "Your sources stay yours",
    body: "Site icons are fetched by SyncPads, not third parties. Page text goes to AI providers only if you turn smart features on.",
  },
];

const startPage = [
  {
    icon: IconLayers,
    title: "Pages and groups",
    body: "Give each part of your work its own page, then group links as a tidy list or as tiles.",
  },
  {
    icon: IconNote,
    title: "Notes beside your links",
    body: "Checklists, snippets and context right next to the tools they belong with. Your AI can read them too.",
  },
  {
    icon: IconSync,
    title: "Synced across devices",
    body: "Sign in anywhere and your workspace is there. Changes appear on your other devices within seconds.",
  },
  {
    icon: IconImport,
    title: "Import in minutes",
    body: "Bring bookmarks from Chrome, Edge, Firefox, Safari or start.me. Folders become pages and groups.",
  },
  {
    icon: IconPalette,
    title: "Make it yours",
    body: "Light or dark, a wallpaper you like, and as many columns as suit your screen.",
  },
  {
    icon: IconBot,
    title: "Smart summaries",
    body: "Turn on smart features and every link gets a short summary and tags, and search finds links by what they're about.",
  },
];

export default async function Home() {
  const session = await getSession();
  const primary = session
    ? { href: "/app", label: "Open your workspace" }
    : { href: "/signup", label: "Create your workspace" };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-900/5 bg-slate-50/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo href="/" height={30} />
          <nav className="flex items-center gap-1 sm:gap-2">
            <a href="#how-it-works" className="btn-ghost hidden sm:inline-flex">
              How it works
            </a>
            {session ? (
              <Link href="/app" className="btn-primary">
                Open app
              </Link>
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

      <main className="flex-1">
        {/* Hero: the outcome */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-[600px] bg-[radial-gradient(60%_60%_at_70%_0%,rgb(219_234_254/0.9),transparent_70%)]"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:pb-28 lg:pt-20">
            <div>
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-900/10 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-sync-500" />
                Works with Claude, ChatGPT and Cursor
              </p>
              <h1 className="text-balance text-4xl font-bold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.35rem]">
                The place your AI goes to <span className="text-sync-600">understand how you work.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
                SyncPads is your start page: the tools, docs and notes you rely on, organized your way. Connect your AI and it
                uses them too, and keeps what you decide, so you stop re-explaining your work in every chat.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={primary.href} className="btn-primary px-5 py-3 text-base">
                  {primary.label}
                  <IconArrowRight />
                </Link>
                <a href="#how-it-works" className="btn-secondary px-5 py-3 text-base">
                  See how it works
                </a>
              </div>
              <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
                {["Free to start", "You approve every change", "Works with any MCP app"].map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <IconCheck size={15} className="text-sync-600" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <HeroPreview />
          </div>
        </section>

        {/* The problem */}
        <section className="border-t border-slate-900/5 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
            <p className="text-sm font-semibold uppercase tracking-wider text-sync-600">The problem</p>
            <h2 className="mt-3 max-w-2xl text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Every chat with your AI starts from zero.
            </h2>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {problems.map((p, i) => (
                <div key={p.title} className="rounded-2xl border border-slate-900/[0.07] bg-slate-50 p-6">
                  <span className="text-sm font-bold text-slate-400">0{i + 1}</span>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">{p.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{p.body}</p>
                </div>
              ))}
            </div>
            <p className="mt-10 max-w-2xl text-lg leading-relaxed text-slate-700">
              The knowledge your AI is missing is already in your bookmarks: years of sources you chose and trust.{" "}
              <strong className="font-semibold text-slate-900">SyncPads puts it where every AI you use can reach it.</strong>
            </p>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-16">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
            <p className="text-sm font-semibold uppercase tracking-wider text-sync-600">How it works</p>
            <h2 className="mt-3 max-w-2xl text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Organize once. Every AI you use understands your work.
            </h2>
            <ol className="mt-12 grid gap-4 md:grid-cols-3">
              {steps.map((step, i) => (
                <li key={step.title} className="rounded-2xl border border-slate-900/[0.07] bg-white p-6 shadow-sm">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Who it's for */}
        <section className="border-y border-slate-900/5 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
            <p className="text-sm font-semibold uppercase tracking-wider text-sync-600">Built for how you work</p>
            <h2 className="mt-3 max-w-2xl text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Ask your AI about your work. It already knows where to look.
            </h2>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {audiences.map(({ icon: Icon, who, ask, body }) => (
                <div key={who} className="flex flex-col rounded-2xl border border-slate-900/[0.07] p-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                    <Icon size={20} />
                  </span>
                  <h3 className="mt-4 font-semibold text-slate-900">{who}</h3>
                  <p className="mt-3 rounded-xl rounded-bl-sm bg-slate-100 px-3.5 py-2.5 text-sm font-medium text-slate-800">{ask}</p>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Control */}
        <section className="overflow-hidden bg-slate-950 text-white">
          <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:py-24">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-40 top-0 h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,rgb(30_64_175/0.35),transparent_65%)]"
            />
            <div className="relative">
              <p className="text-sm font-semibold uppercase tracking-wider text-sync-400">You stay in control</p>
              <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
                Your AI can use your workspace. It can&apos;t take it over.
              </h2>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-slate-300">
                Every assistant you connect gets only the access you give it, and everything it does is on record.
              </p>
              <div className="mt-10 grid gap-x-8 gap-y-7 sm:grid-cols-2">
                {controls.map(({ icon: Icon, title, body }) => (
                  <div key={title}>
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-sync-400 ring-1 ring-white/10">
                      <Icon size={18} />
                    </span>
                    <h3 className="mt-3 font-semibold">{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-400">{body}</p>
                  </div>
                ))}
              </div>
            </div>
            <InboxPreview />
          </div>
        </section>

        {/* The start page */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
          <p className="text-sm font-semibold uppercase tracking-wider text-sync-600">Your Personalized Workspace</p>
          <h2 className="mt-3 max-w-2xl text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            And a start page you&apos;ll want to open every day.
          </h2>
          <p className="mt-3 max-w-2xl text-lg text-slate-600">
            Organize. Access. Get More Done. Everything you use, one click away, in every new tab.
          </p>
          <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {startPage.map(({ icon: Icon, title, body }) => (
              <div key={title}>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/10">
                  <Icon size={20} />
                </span>
                <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Closing call to action */}
        <section className="px-4 pb-20 sm:px-6">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-slate-950 px-6 py-14 text-center sm:px-12">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_80%_at_50%_0%,rgb(30_64_175/0.35),transparent_70%)]"
            />
            <div className="relative">
              <Logo tone="dark" height={34} className="mx-auto" />
              <h2 className="mx-auto mt-6 max-w-2xl text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Teach your AI how you work. Once.
              </h2>
              <p className="mx-auto mt-3 max-w-md text-balance text-slate-300">
                Build your start page in minutes, connect your AI, and stop starting every chat from zero.
              </p>
              <Link href={primary.href} className="btn-primary mt-8 px-6 py-3 text-base">
                {primary.label}
                <IconArrowRight />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-900/5 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <LogoMark size={22} />
            <span>© {new Date().getFullYear()} SyncPads</span>
          </div>
          <nav className="flex gap-5">
            <Link href="/login" className="hover:text-slate-900">Sign in</Link>
            <Link href="/signup" className="hover:text-slate-900">Create account</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

/** Hero picture: the start page, with an AI answering from it. Decorative only. */
function HeroPreview() {
  const tools = [
    { name: "Acme brief", color: "bg-blue-500" },
    { name: "Acme analytics", color: "bg-sync-500" },
    { name: "Acme ad account", color: "bg-emerald-500" },
    { name: "Shared drive", color: "bg-violet-500" },
  ];
  const tiles = ["bg-sky-500", "bg-slate-900", "bg-rose-500", "bg-amber-500", "bg-teal-500", "bg-indigo-500"];

  return (
    <div aria-hidden="true" className="relative pb-24 sm:pb-16">
      <div className="relative overflow-hidden rounded-3xl border border-slate-900/10 bg-gradient-to-br from-slate-900 to-slate-800 p-3 shadow-2xl shadow-slate-900/20">
        <div className="rounded-2xl bg-slate-100/95 p-3">
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-white/90 px-3 py-2 shadow-sm">
            <LogoMark size={18} />
            <span className="px-2 text-[11px] font-medium text-slate-500">Home</span>
            <span className="relative rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white after:absolute after:inset-x-2 after:-bottom-[4px] after:h-0.5 after:rounded-full after:bg-sync-500">
              Acme
            </span>
            <span className="px-2 text-[11px] font-medium text-slate-500">Research</span>
            <span className="ml-auto h-5 w-5 rounded-full bg-slate-900" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white p-3 shadow-sm">
              <p className="mb-2 text-[11px] font-semibold text-slate-900">Client</p>
              {tools.map((t) => (
                <div key={t.name} className="flex items-center gap-2 py-1">
                  <span className={`h-3.5 w-3.5 rounded ${t.color}`} />
                  <span className="truncate text-[11px] text-slate-700">{t.name}</span>
                </div>
              ))}
            </div>
            <div className="rounded-xl bg-white p-3 shadow-sm">
              <p className="mb-2 text-[11px] font-semibold text-slate-900">Tools</p>
              <div className="grid grid-cols-3 gap-2">
                {tiles.map((c, i) => (
                  <span key={i} className={`aspect-square rounded-lg ${c} opacity-90`} />
                ))}
              </div>
            </div>
            <div className="col-span-2 rounded-xl bg-white p-3 shadow-sm sm:col-span-1">
              <p className="mb-2 text-[11px] font-semibold text-slate-900">Notes</p>
              <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-2">
                <p className="text-[11px] font-semibold text-slate-800">Q4 launch</p>
                <div className="mt-1.5 space-y-1.5">
                  <span className="block h-1.5 w-5/6 rounded bg-slate-300" />
                  <span className="block h-1.5 w-2/3 rounded bg-slate-300" />
                  <span className="block h-1.5 w-3/4 rounded bg-slate-300" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* The AI answering from the start page */}
      <div className="absolute -bottom-2 left-4 right-4 rounded-2xl border border-slate-900/10 bg-white p-4 shadow-2xl sm:-left-8 sm:right-auto sm:w-[22rem]">
        <p className="ml-auto w-fit rounded-2xl rounded-br-md bg-slate-100 px-3.5 py-2 text-[13px] text-slate-800">
          Pull up the Acme analytics.
        </p>
        <div className="mt-3 flex gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900">
            <IconBot size={15} className="text-sync-400" />
          </span>
          <div className="min-w-0 text-[13px] text-slate-700">
            <span className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              <LogoMark size={12} />
              Searched SyncPads
            </span>
            <p>
              Here&apos;s <span className="font-semibold text-slate-900">Acme analytics</span> from your Acme page, next to
              your Q4 launch notes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Control section picture: an inbox suggestion waiting for approval. Decorative only. */
function InboxPreview() {
  return (
    <div aria-hidden="true" className="relative space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur-sm">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <IconBot size={16} className="text-sync-400" />
          Claude · activity
        </p>
        <ul className="mt-3 space-y-2 text-[13px] text-slate-300">
          {[
            ["Searched", "“acme analytics”"],
            ["Read a page", "Acme"],
            ["Suggested a link", "Material Symbols"],
          ].map(([a, b]) => (
            <li key={a} className="flex justify-between gap-3 border-b border-white/5 pb-2 last:border-0 last:pb-0">
              <span>{a}</span>
              <span className="truncate text-slate-400">{b}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white p-4 text-slate-900 shadow-2xl sm:ml-12">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <IconInbox size={16} />
            Agent Inbox
          </p>
          <span className="rounded-full bg-sync-600 px-2 py-0.5 text-[11px] font-bold text-white">1</span>
        </div>
        <div className="mt-3 rounded-xl border border-slate-900/[0.08] p-3">
          <p className="text-sm font-semibold">Material Symbols</p>
          <p className="text-xs text-slate-500">fonts.google.com</p>
          <p className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
            <span className="font-semibold">Claude:</span> &ldquo;You asked for an icon set for the Acme redesign.&rdquo;
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <span className="flex items-center justify-center gap-1 rounded-lg border border-slate-300 py-1.5 text-xs font-semibold">
              <IconX size={12} />
              Dismiss
            </span>
            <span className="flex items-center justify-center gap-1 rounded-lg bg-sync-600 py-1.5 text-xs font-semibold text-white">
              <IconCheck size={12} />
              Approve
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
