"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconBell, IconBot, IconMegaphone, IconUsers, IconX } from "@/components/icons";
import { api } from "./api";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
};

const POLL_MS = 30_000;

function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function TypeIcon({ type }: { type: string }) {
  const Icon = type === "announcement" || type === "gallery" || type === "admin_message" ? IconMegaphone : type === "agent_suggestion" ? IconBot : IconUsers;
  const tone =
    type === "announcement"
      ? "bg-sync-500/15 text-sync-600 dark:text-sync-300"
      : "bg-slate-900/[0.06] text-slate-600 dark:bg-white/10 dark:text-slate-300";
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone}`}>
      <Icon size={16} />
    </span>
  );
}

/**
 * The bell in the top bar: unread count (polled), and a panel with the latest
 * notifications. Clicking one marks it read and opens what it's about.
 */
export function NotificationsBell({ onOpenPage, onOpenInbox }: { onOpenPage: (pageId: string) => void; onOpenInbox: () => void }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Notification[] | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const poll = useCallback(async () => {
    try {
      setUnread((await api<{ unread: number }>("GET", "/api/notifications/unread")).unread);
    } catch {
      /* offline: keep the last count */
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await api<{ items: Notification[]; unread: number }>("GET", "/api/notifications");
      setItems(res.items);
      setUnread(res.unread);
    } catch {
      setItems((list) => list ?? []);
    }
  }, []);

  useEffect(() => {
    void poll();
    const timer = setInterval(poll, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [poll]);

  useEffect(() => {
    if (!open) return;
    void load();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open, load]);

  async function markRead(ids: string[] | "all") {
    setItems((list) => list?.map((n) => (ids === "all" || ids.includes(n.id) ? { ...n, read: true } : n)) ?? null);
    try {
      const res = await api<{ unread: number }>("POST", "/api/notifications/read", ids === "all" ? { all: true } : { ids });
      setUnread(res.unread);
    } catch {
      /* it'll be read next time */
    }
  }

  function openItem(n: Notification) {
    if (!n.read) void markRead([n.id]);
    if (!n.link) return;
    const page = n.link.match(/^\/app\?page=([^&]+)/);
    if (page) {
      setOpen(false);
      onOpenPage(decodeURIComponent(page[1]));
    } else if (n.link.startsWith("/app?inbox")) {
      setOpen(false);
      onOpenInbox();
    } else if (n.link.startsWith("https://")) {
      window.open(n.link, "_blank", "noopener,noreferrer");
    } else if (n.link.startsWith("/")) {
      window.location.assign(n.link);
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        className="icon-btn relative"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        title="Notifications"
      >
        <IconBell size={18} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-sync-600 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-950">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-x-2 top-14 z-40 max-h-[75vh] overflow-hidden rounded-2xl border border-slate-900/[0.07] bg-white shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96 dark:border-white/10 dark:bg-slate-900"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="flex items-center justify-between border-b border-slate-900/[0.07] px-4 py-3 dark:border-white/10">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Notifications</h2>
            <span className="flex items-center gap-1">
              {unread > 0 && (
                <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => markRead("all")}>
                  Mark all as read
                </button>
              )}
              <button type="button" className="icon-btn h-7 w-7 sm:hidden" onClick={() => setOpen(false)} aria-label="Close">
                <IconX size={16} />
              </button>
            </span>
          </div>
          <div className="max-h-[calc(75vh-49px)] overflow-y-auto">
            {items === null ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">Loading…</p>
            ) : items.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <IconBell size={22} className="mx-auto text-slate-300 dark:text-slate-600" />
                <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">You&apos;re all caught up</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  News about SyncPads, pages you share, and suggestions from your AI show up here.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-900/[0.05] dark:divide-white/5">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => openItem(n)}
                      className={`flex w-full gap-3 px-4 py-3 text-left transition hover:bg-slate-900/[0.03] dark:hover:bg-white/5 ${
                        n.read ? "" : "bg-sync-500/[0.04]"
                      }`}
                    >
                      <TypeIcon type={n.type} />
                      <span className="min-w-0 flex-1">
                        {(n.type === "announcement" || n.type === "admin_message") && (
                          <span className="mb-0.5 block text-[11px] font-bold uppercase tracking-wider text-sync-600 dark:text-sync-300">
                            {n.type === "announcement" ? "What's new" : "Message from SyncPads"}
                          </span>
                        )}
                        <span className={`block text-sm leading-snug ${n.read ? "text-slate-700 dark:text-slate-300" : "font-semibold text-slate-900 dark:text-white"}`}>
                          {n.title}
                        </span>
                        {n.body && <span className="mt-0.5 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">{n.body}</span>}
                        <span className="mt-1 block text-[11px] text-slate-400 dark:text-slate-500">{ago(n.createdAt)}</span>
                      </span>
                      {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sync-600" aria-label="Unread" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
