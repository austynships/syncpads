"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Logo, LogoMark } from "@/components/brand";
import { IconLogOut, IconSliders, IconUser } from "@/components/icons";
import type { Wallpaper } from "@/db/schema";
import { authClient } from "@/lib/auth-client";
import type { GroupDTO, ItemDTO, PageLayout, StateDTO, Theme } from "@/lib/start-page-types";
import { normalizeUrl } from "@/lib/url";
import { wallpaperCss } from "@/lib/wallpapers";
import { api } from "./api";
import { PageBoard, type BoardActions } from "./board";
import { PageTabs } from "./page-tabs";
import { SearchBar } from "./search-bar";
import { SettingsPanel } from "./settings-panel";
import { mapGroup, mapItem, mapPage, removeItem, reorderBy, setPageGroups } from "./state-ops";
import { clearCache, useStartPage } from "./use-start-page";

type Toast = { id: number; message: string; action?: { label: string; run: () => void } };

export function StartPage({ userId, email }: { userId: string; email: string }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback((message: string, action?: Toast["action"]) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);

  const { state, offline, refresh, mutate } = useStartPage(userId, toast);
  const [pageId, setPageId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(`syncpads:page:${userId}`);
    } catch {
      return null;
    }
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  const page = state?.pages.find((p) => p.id === pageId) ?? state?.pages[0];
  const selectPage = (id: string) => {
    setPageId(id);
    try {
      localStorage.setItem(`syncpads:page:${userId}`, id);
    } catch {}
  };

  const dark = useDarkMode(state?.settings.theme ?? "system");

  // ---------- actions ----------

  const actions: BoardActions = useMemo(
    () => ({
      addGroup: (pid, name) => mutate(null, () => api("POST", "/api/groups", { pageId: pid, name })),
      renameGroup: (id, name) =>
        mutate((s) => mapGroup(s, id, (g) => ({ ...g, name })), () => api("PATCH", `/api/groups/${id}`, { name })),
      setGroupLayout: (id, layout) =>
        mutate((s) => mapGroup(s, id, (g) => ({ ...g, layout })), () => api("PATCH", `/api/groups/${id}`, { layout })),
      deleteGroup: (id) =>
        mutate(
          (s) => ({ ...s, pages: s.pages.map((p) => ({ ...p, groups: p.groups.filter((g) => g.id !== id) })) }),
          () => api("DELETE", `/api/groups/${id}`),
        ),
      addLink: async (groupId, url, title) => {
        if (!normalizeUrl(url)) {
          toast("That doesn't look like a valid web address.");
          return false;
        }
        const res = await mutate(
          null,
          () => api<{ revision: number; item: ItemDTO }>("POST", "/api/items", { groupId, type: "link", url, title }),
          (r, s) => mapGroup(s, groupId, (g) => ({ ...g, items: [...g.items, r.item] })),
        );
        return res !== null;
      },
      addNote: async (groupId) => {
        const res = await mutate(
          null,
          () => api<{ revision: number; item: ItemDTO }>("POST", "/api/items", { groupId, type: "note", noteBody: "" }),
          (r, s) => mapGroup(s, groupId, (g) => ({ ...g, items: [...g.items, r.item] })),
        );
        return res?.item.id ?? null;
      },
      saveLink: (id, fields) =>
        mutate(
          (s) => mapItem(s, id, (i) => ({ ...i, title: fields.title || null })),
          () => api<{ revision: number; item: ItemDTO }>("PATCH", `/api/items/${id}`, fields),
          (r, s) => mapItem(s, id, () => r.item),
        ),
      saveNote: (id, noteBody) =>
        mutate(
          (s) => mapItem(s, id, (i) => ({ ...i, noteBody })),
          () => api<{ revision: number; item: ItemDTO }>("PATCH", `/api/items/${id}`, { noteBody }),
          (r, s) => mapItem(s, id, () => r.item),
        ),
      deleteItem: async (id) => {
        const res = await mutate((s) => removeItem(s, id), () => api("DELETE", `/api/items/${id}`));
        if (res) {
          toast("Deleted.", {
            label: "Undo",
            run: () => mutate(null, () => api("POST", `/api/items/${id}/restore`)).then(() => refresh()),
          });
        }
      },
      commitDrag: (pid, groups: GroupDTO[], change) =>
        mutate(
          (s) => setPageGroups(s, pid, groups),
          async () => {
            let last = { revision: 0 };
            if (change.groupsMoved) {
              last = await api("PUT", "/api/groups/order", { pageId: pid, ids: groups.map((g) => g.id) });
            }
            for (const gid of change.itemGroupIds) {
              const g = groups.find((x) => x.id === gid);
              if (g) last = await api("PUT", "/api/items/order", { groupId: gid, ids: g.items.map((i) => i.id) });
            }
            return last;
          },
        ),
    }),
    [mutate, refresh, toast],
  );

  const addPage = async (name: string) => {
    const res = await mutate(null, () => api<{ revision: number; id: string }>("POST", "/api/pages", { name }));
    if (res) {
      await refresh();
      selectPage(res.id);
    }
  };
  const reorderPages = (ids: string[]) =>
    mutate((s) => ({ ...s, pages: reorderBy(s.pages, ids) }), () => api("PUT", "/api/pages/order", { ids }));
  const renamePage = (id: string, name: string) =>
    mutate((s) => mapPage(s, id, (p) => ({ ...p, name })), () => api("PATCH", `/api/pages/${id}`, { name }));
  const setPageLayout = (id: string, layout: PageLayout) =>
    mutate((s) => mapPage(s, id, (p) => ({ ...p, layout })), () => api("PATCH", `/api/pages/${id}`, { layout }));
  const deletePage = (id: string) => {
    setSettingsOpen(false);
    return mutate((s) => ({ ...s, pages: s.pages.filter((p) => p.id !== id) }), () => api("DELETE", `/api/pages/${id}`));
  };
  const setTheme = (theme: Theme) =>
    mutate((s) => ({ ...s, settings: { ...s.settings, theme } }), () => api("PATCH", "/api/settings", { theme }));
  const setAiEnabled = (aiEnabled: boolean) =>
    mutate((s) => ({ ...s, settings: { ...s.settings, aiEnabled } }), () => api("PATCH", "/api/settings", { aiEnabled }));
  const setWallpaper = (wallpaper: Wallpaper) =>
    mutate((s) => ({ ...s, settings: { ...s.settings, wallpaper } }), () => api("PATCH", "/api/settings", { wallpaper }));

  // ---------- paste a URL anywhere (SP-4) ----------

  const latest = useRef({ state, page, actions });
  latest.current = { state, page, actions };
  useEffect(() => {
    async function onPaste(e: ClipboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const url = normalizeUrl(e.clipboardData?.getData("text/plain") ?? "");
      const { page: current, actions: a } = latest.current;
      if (!url || !current) return;
      e.preventDefault();

      let groupId = current.groups[0]?.id;
      if (!groupId) {
        const created = await api<{ revision: number; id: string }>("POST", "/api/groups", { pageId: current.id, name: "Links" });
        groupId = created.id;
        await refresh();
      }
      if (await a.addLink(groupId, url, "")) toast(`Added to "${current.groups[0]?.name ?? "Links"}".`);
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [refresh, toast]);

  // ---------- render ----------

  if (!state || !page) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 text-sm text-slate-500">
        <LogoMark size={40} className={offline ? "" : "animate-pulse"} />
        {offline ? "Can't reach SyncPads. Check your connection." : "Loading your workspace…"}
      </main>
    );
  }

  const background = wallpaperCss(state.settings.wallpaper);

  return (
    <div className={dark ? "dark" : ""}>
      <div
        className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100"
        style={background ? { background } : undefined}
      >
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-900/[0.06] bg-white/75 px-3 backdrop-blur-md sm:px-5 dark:border-white/10 dark:bg-slate-950/70">
          <LogoMark size={26} className="sm:hidden" />
          <Logo tone="auto" height={24} className="mr-2 hidden sm:inline-flex" />
          <PageTabs
            pages={state.pages}
            currentId={page.id}
            onSelect={selectPage}
            onAdd={addPage}
            onReorder={reorderPages}
            onRename={renamePage}
          />
          <SearchBar onOpenPage={selectPage} />
          {offline && (
            <span
              className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
              title="Showing your saved copy"
            >
              Offline
            </span>
          )}
          <button type="button" className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="Settings" title="Settings">
            <IconSliders size={18} />
          </button>
          <AccountMenu email={email} userId={userId} />
        </header>

        <main className="p-4 md:p-6">
          <PageBoard key={page.id} page={page} actions={actions} />
        </main>

        {settingsOpen && (
          <SettingsPanel
            settings={state.settings}
            page={page}
            canDeletePage={state.pages.length > 1}
            onClose={() => setSettingsOpen(false)}
            onTheme={setTheme}
            onWallpaper={setWallpaper}
            onAiEnabled={setAiEnabled}
            onPageLayout={(layout) => setPageLayout(page.id, layout)}
            onRenamePage={(name) => renamePage(page.id, name)}
            onDeletePage={() => deletePage(page.id)}
            onImported={async (result) => {
              await refresh();
              if (result.pageIds[0]) selectPage(result.pageIds[0]);
              setSettingsOpen(false);
              toast(
                `Imported ${result.links.toLocaleString()} links into ${result.pages} new ${result.pages === 1 ? "page" : "pages"}.`,
              );
            }}
          />
        )}

        <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2" role="status">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-4 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-xl ring-1 ring-white/10"
            >
              {t.message}
              {t.action && (
                <button
                  type="button"
                  className="font-semibold text-sync-400 hover:text-sync-300"
                  onClick={() => {
                    t.action!.run();
                    setToasts((all) => all.filter((x) => x.id !== t.id));
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AccountMenu({ email, userId }: { email: string; userId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white ring-2 ring-white transition hover:ring-sync-500/40 dark:bg-white dark:text-slate-900 dark:ring-slate-950"
        aria-label="Account"
        aria-expanded={open}
      >
        {email[0]?.toUpperCase()}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-60 rounded-xl border border-slate-900/[0.07] bg-white p-1.5 text-sm shadow-xl dark:border-white/10 dark:bg-slate-900">
          <p className="truncate px-3 pb-2 pt-1.5 text-xs text-slate-500 dark:text-slate-400">{email}</p>
          <Link
            href="/settings"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
          >
            <IconUser size={15} />
            Account settings
          </Link>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
            onClick={async () => {
              clearCache(userId);
              await authClient.signOut();
              window.location.href = "/login";
            }}
          >
            <IconLogOut size={15} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/** Light/dark mode (SP-5). "system" follows the operating system and updates live. */
function useDarkMode(theme: Theme) {
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return theme === "dark" || (theme === "system" && systemDark);
}

export type { StateDTO };

