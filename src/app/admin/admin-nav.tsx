"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconBot, IconGrid, IconLayers, IconSliders, IconUser } from "@/components/icons";

const ITEMS = [
  { href: "/admin", label: "Overview", Icon: IconGrid },
  { href: "/admin/users", label: "Users", Icon: IconUser },
  { href: "/admin/agents", label: "Agent Connects", Icon: IconBot },
  { href: "/admin/plans", label: "Plans", Icon: IconLayers },
  { href: "/admin/settings", label: "Settings", Icon: IconSliders },
];

/** Sidebar on wide screens, a scrolling tab row on phones. */
export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {ITEMS.map(({ href, label, Icon }) => {
        const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Icon size={16} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
