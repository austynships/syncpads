import Link from "next/link";
import { Logo } from "@/components/brand";
import { IconArrowLeft } from "@/components/icons";
import { AdminNav } from "./admin-nav";
import { requireAdmin } from "./guard";

export const metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <aside className="border-b border-slate-900/5 bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center gap-3 px-4 lg:px-5">
          <Logo height={24} href="/app" />
          <span className="rounded-md bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">Admin</span>
        </div>
        <div className="px-3 pb-3 lg:flex-1 lg:pt-2">
          <AdminNav />
        </div>
        <div className="hidden border-t border-slate-900/5 p-3 lg:block">
          <p className="truncate px-3 pb-2 text-xs text-slate-500">{session.user.email}</p>
          <Link href="/app" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900">
            <IconArrowLeft size={16} />
            Back to workspace
          </Link>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:py-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
