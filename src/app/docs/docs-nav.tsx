"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { DOCS_NAV } from "@/components/docs";

/** Sidebar on wide screens, a page picker on phones. */
export function DocsNav() {
  const path = usePathname();
  const router = useRouter();

  return (
    <>
      <nav aria-label="Documentation" className="hidden lg:block">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Documentation</p>
        <ul className="space-y-0.5">
          {DOCS_NAV.map((item) => {
            const active = path === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`block rounded-lg px-3 py-1.5 text-sm transition ${
                    active
                      ? "bg-slate-900 font-semibold text-white"
                      : "text-slate-600 hover:bg-slate-900/5 hover:text-slate-900"
                  }`}
                >
                  {item.title}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <label className="mb-8 block lg:hidden">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Documentation</span>
        <select className="field" value={path} onChange={(e) => router.push(e.target.value)}>
          {DOCS_NAV.map((item) => (
            <option key={item.href} value={item.href}>
              {item.title}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
