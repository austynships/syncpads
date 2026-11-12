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
  IconNote,
  IconPalette,
  IconShield,
  IconSync,
  IconUndo,
  IconX,
} from "@/components/icons";
import { getSession } from "@/lib/session";

// Every claim here describes something SyncPads does today (brand guide §7).
const features = [
  {
    icon: IconLayers,
    title: "Pages and groups",
    body: "Give each part of your day its own page, then group your links as a tidy list or as tiles.",
  },
  {
    icon: IconNote,
    title: "Notes beside your links",
    body: "Keep checklists, snippets and reminders right next to the tools they belong with.",
  },
  {
    icon: IconSync,
    title: "Synced across devices",
    body: "Sign in anywhere and your workspace is there. Changes appear on your other devices within seconds.",
  },
  {
    icon: IconImport,
    title: "Import in minutes",
    body: "Bring your bookmarks from Chrome, Edge, Firefox, Safari or start.me. Folders become pages and groups.",
  },
  {
    icon: IconPalette,
    title: "Make it yours",
    body: "Light or dark, a wallpaper you like, and as many columns as suit your screen.",
  },
  {
    icon: IconShield,
    title: "Private by design",
    body: "Site icons are fetched by SyncPads, not third parties, so the sites you save stay between you and your workspace.",
  },
];

const steps = [
  { title: "Create your workspace", body: "Sign up with your email. Your first page is ready right away." },
  { title: "Bring your links", body: "Import your bookmarks, or paste any link onto the page to add it." },
  { title: "Start every day here", body: "Set SyncPads as your browser's home page and everything you use is one click away." },
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
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-[560px] bg-[radial-gradient(60%_60%_at_70%_0%,rgb(219_234_254/0.9),transparent_70%)]"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:pb-28 lg:pt-24">
            <div>
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-900/10 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-sync-500" />
                Your Personalized Workspace.
              </p>
              <h1 className="text-balance text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.4rem]">
                Your digital workspace, <span className="text-sync-600">organized your way.</span>
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-slate-600">
                Bring your favorite links, tools, notes, and resources together in one customizable start page.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={primary.href} className="btn-primary px-5 py-3 text-base">
                  {primary.label}
                  <IconArrowRight />
                </Link>
                {!session && (
                  <Link href="/login" className="btn-secondary px-5 py-3 text-base">
                    Sign in
                  </Link>
                )}
              </div>
              <a
                href="#agents"
                className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                <IconBot size={16} className="text-sync-600" />
                Works with Claude, ChatGPT and Cursor
                <IconArrowRight size={14} />
              </a>
            </div>
            <ProductPreview />
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-slate-900/5 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
            <p className="text-sm font-semibold uppercase tracking-wider text-sync-600">Organize. Access. Get More Done.</p>
            <h2 className="mt-3 max-w-2xl text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Everything you use every day, one click away.
            </h2>
            <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, body }) => (
                <div key={title}>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                    <Icon size={20} />
                  </span>
                  <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <AgentsSection primary={primary} />

        {/* How it works */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Set up in minutes.</h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title} className="rounded-2xl border border-slate-900/[0.07] bg-white p-6 shadow-sm">
                <span className="text-sm font-bold text-sync-600">0{i + 1}</span>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{step.body}</p>
              </li>
            ))}
          </ol>
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
              <h2 className="mx-auto mt-6 max-w-xl text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Start with one page. Shape it as you go.
              </h2>
              <p className="mx-auto mt-3 max-w-md text-balance text-slate-300">
                Create your workspace in under a minute, then make it yours.
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

// The agent layer (Phase 5), described as it works today.
const agentPoints = [
  {
    icon: IconBot,
    title: "Your assistant checks here first",
    body: "It searches the links and notes you've saved, by keyword or by meaning, and reads whole pages before reaching for the web.",
  },
  {
    icon: IconInbox,
    title: "You approve every addition",
    body: "Links it suggests wait in your Agent Inbox, with its reason, until you approve or dismiss them.",
  },
  {
    icon: IconEyeOff,
    title: "You set the limits",
    body: "Read only or read and add, chosen pages only. Pages you hide from agents stay invisible, and agents can never delete anything.",
  },
  {
    icon: IconUndo,
    title: "Every action on record",
    body: "See what each assistant searched, read and added, undo what it added, or disconnect it in one click.",
  },
];

function AgentsSection({ primary }: { primary: { href: string; label: string } }) {
  return (
    <section id="agents" className="scroll-mt-16 overflow-hidden bg-slate-950 text-white">
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:py-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-40 top-0 h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,rgb(30_64_175/0.35),transparent_65%)]"
        />
        <div className="relative">
          <p className="text-sm font-semibold uppercase tracking-wider text-sync-400">Works with your AI tools</p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Give your AI assistant the links you already rely on.
          </h2>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-slate-300">
            Connect Claude, ChatGPT, Cursor or any app that supports MCP. Copy one address into the app, sign in, and choose what
            it may do.
          </p>
          <div className="mt-10 grid gap-x-8 gap-y-7 sm:grid-cols-2">
            {agentPoints.map(({ icon: Icon, title, body }) => (
              <div key={title}>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-sync-400 ring-1 ring-white/10">
                  <Icon size={18} />
                </span>
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">{body}</p>
              </div>
            ))}
          </div>
          <Link href={primary.href} className="btn-primary mt-10 px-5 py-3 text-base">
            {primary.label}
            <IconArrowRight />
          </Link>
        </div>
        <AgentPreview />
      </div>
    </section>
  );
}

/** A static picture of an assistant using SyncPads, and the inbox. Decorative only. */
function AgentPreview() {
  return (
    <div aria-hidden="true" className="relative space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur-sm">
        <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-white/10 px-4 py-2.5 text-sm text-slate-100">
          Which tools did I save for design work?
        </div>
        <div className="mt-4 flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10">
            <IconBot size={15} className="text-sync-400" />
          </span>
          <div className="min-w-0 flex-1 text-sm text-slate-200">
            <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-slate-300">
              <LogoMark size={12} />
              Searched SyncPads
            </span>
            <p>You have three on your Work page:</p>
            <ul className="mt-2 space-y-1.5">
              {[
                ["Figma", "Design files and prototypes", "bg-violet-500"],
                ["Coolors", "Color palettes", "bg-sync-500"],
                ["Unsplash", "Free photos", "bg-slate-400"],
              ].map(([name, note, color]) => (
                <li key={name} className="flex items-center gap-2">
                  <span className={`h-3.5 w-3.5 rounded ${color}`} />
                  <span className="font-medium text-white">{name}</span>
                  <span className="truncate text-slate-400">— {note}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
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
            <span className="font-semibold">Claude:</span> &ldquo;You asked for an icon set for the redesign.&rdquo;
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

/** A small, static picture of a SyncPads workspace. Decorative only. */
function ProductPreview() {
  const tools = [
    { name: "Inbox", color: "bg-blue-500" },
    { name: "Calendar", color: "bg-sync-500" },
    { name: "Project board", color: "bg-emerald-500" },
    { name: "Analytics", color: "bg-violet-500" },
  ];
  const tiles = ["bg-sky-500", "bg-slate-900", "bg-rose-500", "bg-amber-500", "bg-teal-500", "bg-indigo-500"];

  return (
    <div aria-hidden="true" className="relative">
      <div className="absolute -inset-4 rounded-[2rem] bg-slate-900/[0.03] blur-sm" />
      <div className="relative overflow-hidden rounded-3xl border border-slate-900/10 bg-gradient-to-br from-slate-900 to-slate-800 p-3 shadow-2xl shadow-slate-900/20">
        <div className="rounded-2xl bg-slate-100/95 p-3">
          {/* top bar */}
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-white/90 px-3 py-2 shadow-sm">
            <LogoMark size={18} />
            <span className="relative rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white after:absolute after:inset-x-2 after:-bottom-[4px] after:h-0.5 after:rounded-full after:bg-sync-500">
              Home
            </span>
            <span className="px-2 text-[11px] font-medium text-slate-500">Work</span>
            <span className="px-2 text-[11px] font-medium text-slate-500">Research</span>
            <span className="ml-auto h-5 w-5 rounded-full bg-slate-900" />
          </div>
          {/* groups */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white p-3 shadow-sm">
              <p className="mb-2 text-[11px] font-semibold text-slate-900">Daily tools</p>
              {tools.map((t) => (
                <div key={t.name} className="flex items-center gap-2 py-1">
                  <span className={`h-3.5 w-3.5 rounded ${t.color}`} />
                  <span className="text-[11px] text-slate-700">{t.name}</span>
                </div>
              ))}
            </div>
            <div className="rounded-xl bg-white p-3 shadow-sm">
              <p className="mb-2 text-[11px] font-semibold text-slate-900">Favorites</p>
              <div className="grid grid-cols-3 gap-2">
                {tiles.map((c, i) => (
                  <span key={i} className={`aspect-square rounded-lg ${c} opacity-90`} />
                ))}
              </div>
            </div>
            <div className="col-span-2 rounded-xl bg-white p-3 shadow-sm sm:col-span-1">
              <p className="mb-2 text-[11px] font-semibold text-slate-900">Notes</p>
              <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-2">
                <p className="text-[11px] font-semibold text-slate-800">This week</p>
                <div className="mt-1.5 space-y-1.5">
                  <span className="block h-1.5 w-5/6 rounded bg-slate-300" />
                  <span className="block h-1.5 w-2/3 rounded bg-slate-300" />
                  <span className="block h-1.5 w-3/4 rounded bg-slate-300" />
                </div>
              </div>
            </div>
            <div className="col-span-2 rounded-xl bg-white p-3 shadow-sm sm:col-span-3">
              <p className="mb-2 text-[11px] font-semibold text-slate-900">Clients</p>
              <div className="flex flex-wrap gap-2">
                {["Acme Co", "Northwind", "Globex", "Initech"].map((c) => (
                  <span key={c} className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
