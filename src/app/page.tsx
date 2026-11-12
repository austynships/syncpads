import Link from "next/link";
import { getSession } from "@/lib/session";

const features = [
  {
    title: "Pages, groups and links",
    body: "Organize your bookmarks into pages and groups. Drag to reorder, or paste a URL anywhere to add it.",
  },
  {
    title: "Notes beside your links",
    body: "Keep rich-text notes right next to the links they belong with.",
  },
  {
    title: "Synced everywhere",
    body: "Changes show up on every device within seconds, and the page loads instantly from cache.",
  },
  {
    title: "Make it yours",
    body: "List or tile layouts, light and dark themes, and wallpapers.",
  },
  {
    title: "Private by design",
    body: "Favicons are fetched by our server, so no third party sees the links you save.",
  },
  {
    title: "Built for AI",
    body: "SyncPads is the start page your AI assistant can read and use. More on that soon.",
  },
];

export default async function Home() {
  const session = await getSession();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5">
        <Link href="/" className="text-lg font-semibold">
          SyncPads
        </Link>
        <nav className="flex items-center gap-2 text-sm">
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
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-4 pb-16 pt-16 text-center sm:pt-24">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            The start page your AI can use.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-zinc-600">
            SyncPads keeps your links and notes on one fast, tidy page, synced across every
            device you use.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link
              href={session ? "/app" : "/signup"}
              className="rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700"
            >
              {session ? "Open your start page" : "Create a free account"}
            </Link>
            {!session && (
              <Link
                href="/login"
                className="rounded-md border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium hover:bg-zinc-100"
              >
                Sign in
              </Link>
            )}
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-4 px-4 pb-24 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold">{f.title}</h2>
              <p className="mt-1.5 text-sm text-zinc-600">{f.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-zinc-200 py-6 text-center text-sm text-zinc-500">
        © {new Date().getFullYear()} SyncPads
      </footer>
    </div>
  );
}
