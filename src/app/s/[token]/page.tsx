import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Logo, LogoMark } from "@/components/brand";
import { Favicon } from "@/components/start/favicon";
import { sanitizeNoteHtml } from "@/lib/sanitize";
import { wallpaperCss } from "@/lib/wallpapers";
import { getSession } from "@/lib/session";
import { getSharedPage, type SharedPage } from "@/server/share";
import { SaveCopy } from "./save-copy";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

// Shared pages are unlisted: only people with the link should find them.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await getSharedPage((await params).token);
  if (!page) return { title: "Page not found", robots: { index: false, follow: false } };
  const description = `${page.ownerName} shared ${plural(page.links, "link", "links")} with you on SyncPads.`;
  return {
    title: { absolute: `${page.name} · Shared on SyncPads` },
    description,
    robots: { index: false, follow: false },
    openGraph: { title: page.name, description, siteName: "SyncPads", type: "website" },
    referrer: "no-referrer",
  };
}

const COLUMNS: Record<string, string> = {
  "1": "",
  "2": "md:grid-cols-2",
  "3": "md:grid-cols-2 lg:grid-cols-3",
  "4": "md:grid-cols-2 lg:grid-cols-4",
  "5": "md:grid-cols-3 lg:grid-cols-5",
  auto: "md:grid-cols-2 lg:grid-cols-3",
};

/**
 * A page someone shared: read-only, with "Save a copy" to add it to your own
 * SyncPads. No analytics run here, since the content is someone's own.
 */
export default async function SharedPageView({ params }: Props) {
  const { token } = await params;
  const [page, session] = await Promise.all([getSharedPage(token), getSession()]);
  if (!page) notFound();
  const isOwner = session?.user.id === page.ownerId;
  // The owner's look: light, dark, or "system" (follows the visitor's device, via the
  // .theme-system dark variant in globals.css), plus their wallpaper.
  const themeClass = page.theme === "dark" ? "dark" : page.theme === "system" ? "theme-system" : "";
  const background = wallpaperCss(page.wallpaper);
  // Over a wallpaper, text sits on frosted panels so it stays readable.
  const panel = background ? "rounded-2xl bg-white/85 px-5 py-4 shadow-sm backdrop-blur-md dark:bg-slate-900/80" : "";

  return (
    <div className={`${themeClass} min-h-screen`}>
    <div
      className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100"
      style={background ? { background, backgroundAttachment: "fixed" } : undefined}
    >
      <header className="sticky top-0 z-10 border-b border-slate-900/5 bg-white/75 backdrop-blur-md dark:border-white/10 dark:bg-slate-950/70">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Logo href="/" height={26} tone="auto" />
          {!isOwner && <SaveCopy token={token} signedIn={Boolean(session)} />}
        </div>
      </header>

      {isOwner && (
        <div className="border-b border-sync-500/20 bg-sync-50 text-sm text-slate-700 dark:bg-sync-500/15 dark:text-slate-200">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-6">
            <span>
              This is how your shared page looks to others.{" "}
              {page.copies > 0 && <strong>{plural(page.copies, "person has", "people have")} saved a copy. </strong>}
            </span>
            {/* Plain <a>: the app is a separate client bundle. */}
            <a href={`/app?page=${encodeURIComponent(page.pageId)}`} className="font-semibold text-sync-700 hover:underline dark:text-sync-300">
              Manage sharing →
            </a>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-10 sm:px-6">
        <div className={`mb-8 ${panel}`}>
          <p className="text-sm font-semibold uppercase tracking-wider text-sync-600 dark:text-sync-400">Shared page</p>
          <h1 className="mt-2 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">{page.name}</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Shared by {page.ownerName} · {plural(page.links, "link", "links")}
            {page.notes > 0 && ` · ${plural(page.notes, "note", "notes")}`}
          </p>
        </div>

        {page.groups.length === 0 ? (
          <p className="rounded-2xl border border-slate-900/[0.07] bg-white/85 p-8 text-center text-slate-500 backdrop-blur-md dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-400">This page is empty for now.</p>
        ) : (
          <div className={`grid items-start gap-4 ${COLUMNS[page.layout] ?? COLUMNS.auto}`}>
            {page.groups.map((group, i) => (
              <Group key={i} group={group} token={token} />
            ))}
          </div>
        )}

        {!isOwner && (
          <section className="mt-14 overflow-hidden rounded-3xl bg-slate-900 px-6 py-10 text-center text-white ring-1 ring-white/10 sm:px-10">
            <h2 className="text-balance text-2xl font-bold tracking-tight">Keep this page, and make it yours</h2>
            <p className="mx-auto mt-2 max-w-xl text-balance text-slate-300">
              Save a copy to your own SyncPads: your links and notes in one place, ready for you and for the AI you work with.
              Free to start.
            </p>
            <div className="mt-6 flex justify-center">
              <SaveCopy token={token} signedIn={Boolean(session)} size="lg" />
            </div>
          </section>
        )}
      </main>

      {/* "Made with SyncPads" badge in place of a footer. Plain <a>: a full page load to the landing page. */}
      <a
        href="/"
        className="fixed bottom-4 right-4 z-20 inline-flex items-center gap-2 rounded-full border border-slate-900/[0.08] bg-white/95 py-1.5 pl-1.5 pr-3.5 text-sm font-semibold text-slate-800 shadow-lg shadow-slate-900/10 backdrop-blur transition hover:-translate-y-0.5 hover:shadow-xl dark:border-white/10 dark:bg-slate-900/95 dark:text-slate-100 dark:shadow-black/30"
      >
        <LogoMark size={24} />
        Made with SyncPads
      </a>
    </div>
    </div>
  );
}

function Group({ group, token }: { group: SharedPage["groups"][number]; token: string }) {
  const links = group.items.filter((i) => i.type === "link");
  const notes = group.items.filter((i) => i.type === "note");
  const tiles = group.layout === "tiles";

  return (
    <section className="card p-4">
      <h2 className="mb-2 px-1 text-sm font-bold text-slate-900 dark:text-white">{group.name}</h2>
      {links.length > 0 &&
        (tiles ? (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {links.map((l, i) => (
              <li key={i}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="flex flex-col items-center gap-1.5 rounded-xl p-2 text-center hover:bg-slate-900/5 dark:hover:bg-white/10"
                  title={l.url}
                >
                  <Favicon url={l.url} size={32} shareToken={token} />
                  <span className="line-clamp-2 text-xs text-slate-700 dark:text-slate-300">{l.title || l.host}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <ul>
            {links.map((l, i) => (
              <li key={i}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="group flex items-center gap-2.5 rounded-lg px-1 py-1.5 hover:bg-slate-900/5 dark:hover:bg-white/10"
                  title={l.url}
                >
                  <Favicon url={l.url} size={16} shareToken={token} />
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-800 group-hover:text-slate-950 dark:text-slate-200 dark:group-hover:text-white">{l.title || l.host}</span>
                  <span className="hidden shrink-0 text-xs text-slate-400 sm:inline dark:text-slate-500">{l.host}</span>
                </a>
              </li>
            ))}
          </ul>
        ))}
      {notes.map((n, i) => (
        <div key={i} className="mt-2 rounded-xl bg-amber-50/70 p-3 text-sm text-slate-800 dark:bg-amber-400/10 dark:text-slate-200">
          {n.title && <p className="mb-1 font-semibold text-slate-900 dark:text-white">{n.title}</p>}
          {n.body && (
            // Stored notes are already sanitized; cleaned again here since this page is public.
            <div className="note-content" dangerouslySetInnerHTML={{ __html: sanitizeNoteHtml(n.body) }} />
          )}
        </div>
      ))}
    </section>
  );
}
