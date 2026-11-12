"use client";

import { useEffect, useState } from "react";
import type { Wallpaper } from "@/db/schema";
import Link from "next/link";
import { IconBot, IconEyeOff, IconMonitor, IconMoon, IconSun, IconTrash, IconX } from "@/components/icons";
import type { PageDTO, PageLayout, SettingsDTO, Theme } from "@/lib/start-page-types";
import { PRESET_COLORS, PRESET_WALLPAPERS } from "@/lib/wallpapers";
import { ImportBookmarks } from "./import-bookmarks";

type Props = {
  settings: SettingsDTO;
  page: PageDTO;
  canDeletePage: boolean;
  onClose: () => void;
  onTheme: (theme: Theme) => void;
  onWallpaper: (wallpaper: Wallpaper) => void;
  onAiEnabled: (enabled: boolean) => void;
  onHiddenFromAgents: (hidden: boolean) => void;
  onPageLayout: (layout: PageLayout) => void;
  onRenamePage: (name: string) => void;
  onDeletePage: () => void;
  onImported: (result: { pageIds: string[]; links: number; pages: number }) => void;
};

const THEMES: { value: Theme; label: string; icon: typeof IconSun }[] = [
  { value: "system", label: "System", icon: IconMonitor },
  { value: "light", label: "Light", icon: IconSun },
  { value: "dark", label: "Dark", icon: IconMoon },
];

/** Appearance (SP-5), import (SP-9) and current-page settings, in a side panel. */
export function SettingsPanel(p: Props) {
  const [imageUrl, setImageUrl] = useState(p.settings.wallpaper.type === "url" ? p.settings.wallpaper.value : "");
  const wp = p.settings.wallpaper;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && p.onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [p]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/30 backdrop-blur-[2px]" onClick={p.onClose}>
      <aside
        className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
        aria-label="Settings"
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-center justify-between border-b border-slate-900/[0.07] px-6 py-4 dark:border-white/10">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Settings</h2>
          <button type="button" className="icon-btn" onClick={p.onClose} aria-label="Close settings">
            <IconX size={18} />
          </button>
        </header>

        <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
          <section>
            <h3 className="label">Theme</h3>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-950/60">
              {THEMES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => p.onTheme(value)}
                  aria-pressed={p.settings.theme === value}
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition ${
                    p.settings.theme === value
                      ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="label">Wallpaper</h3>
            <div className="mb-3 grid grid-cols-5 gap-2">
              <Swatch selected={wp.type === "none"} onClick={() => p.onWallpaper({ type: "none" })} label="None">
                <span className="text-[11px] font-medium text-slate-500">None</span>
              </Swatch>
              {Object.entries(PRESET_WALLPAPERS).map(([key, w]) => (
                <Swatch
                  key={key}
                  label={w.name}
                  selected={wp.type === "preset" && wp.value === key}
                  style={{ background: w.css }}
                  onClick={() => p.onWallpaper({ type: "preset", value: key })}
                />
              ))}
              {PRESET_COLORS.map((c) => (
                <Swatch
                  key={c}
                  label={c}
                  selected={wp.type === "color" && wp.value === c}
                  style={{ background: c }}
                  onClick={() => p.onWallpaper({ type: "color", value: c })}
                />
              ))}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (imageUrl.trim()) p.onWallpaper({ type: "url", value: imageUrl.trim() });
              }}
            >
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Image URL (https://…)"
                className="field"
                aria-label="Wallpaper image URL"
              />
              <button type="submit" className="btn-secondary shrink-0">Use</button>
            </form>
          </section>

          <section>
            <SmartFeatures
              enabled={p.settings.aiEnabled ?? false}
              available={p.settings.aiAvailable ?? { summaries: false, embeddings: false }}
              onChange={p.onAiEnabled}
            />
          </section>

          <section>
            <h3 className="label">AI agents</h3>
            <Link href="/agents" className="btn-secondary w-full justify-between">
              <span className="flex items-center gap-2">
                <IconBot size={16} />
                Connect agents, permissions and activity
              </span>
              <span aria-hidden="true">→</span>
            </Link>
          </section>

          <section>
            <ImportBookmarks onImported={p.onImported} />
          </section>

          <section>
            <h3 className="label">This page</h3>
            <form
              className="mb-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const name = String(new FormData(e.currentTarget).get("name")).trim();
                if (name) p.onRenamePage(name);
              }}
            >
              <input key={p.page.id} name="name" defaultValue={p.page.name} className="field" aria-label="Page name" />
              <button type="submit" className="btn-secondary shrink-0">Rename</button>
            </form>
            <label className="mb-4 flex items-center justify-between gap-2 text-sm font-medium text-slate-800 dark:text-slate-200">
              Columns
              <select
                value={p.page.layout}
                onChange={(e) => p.onPageLayout(e.target.value as PageLayout)}
                className="field w-32"
              >
                <option value="auto">Auto</option>
                {["1", "2", "3", "4", "5"].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <label className="mb-4 flex items-center justify-between gap-3 text-sm font-medium text-slate-800 dark:text-slate-200">
              <span className="flex items-center gap-2">
                <IconEyeOff size={16} className="text-slate-500" />
                Hide this page from AI agents
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={p.page.hiddenFromAgents}
                onClick={() => p.onHiddenFromAgents(!p.page.hiddenFromAgents)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${p.page.hiddenFromAgents ? "bg-sync-600" : "bg-slate-300 dark:bg-slate-700"}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${p.page.hiddenFromAgents ? "left-[22px]" : "left-0.5"}`}
                />
              </button>
            </label>
            <button
              type="button"
              disabled={!p.canDeletePage}
              title={p.canDeletePage ? undefined : "You need at least one page"}
              className="btn-ghost w-full justify-center text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-500/10"
              onClick={() => {
                if (confirm(`Delete the page "${p.page.name}" and everything on it?`)) p.onDeletePage();
              }}
            >
              <IconTrash size={15} />
              Delete this page
            </button>
          </section>
        </div>

        <footer className="border-t border-slate-900/[0.07] px-6 py-4 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
          Tip: paste a link anywhere on the page to add it to the first group.
        </footer>
      </aside>
    </div>
  );
}

/**
 * Smart features (SP-13, SP-14): summaries, tags and search by meaning.
 * Off by default; when on, the text of saved pages is sent to Anthropic
 * (summaries) and Voyage AI (search by meaning). Keyword search always works.
 */
function SmartFeatures({
  enabled,
  available,
  onChange,
}: {
  enabled: boolean;
  available: { summaries: boolean; embeddings: boolean };
  onChange: (enabled: boolean) => void;
}) {
  const anyAvailable = available.summaries || available.embeddings;
  return (
    <div>
      <h3 className="label">Smart features</h3>
      <div className="rounded-xl border border-slate-900/10 p-4 dark:border-white/10">
        <label className="flex items-start justify-between gap-4">
          <span>
            <span className="block text-sm font-semibold text-slate-900 dark:text-white">Summaries and search by meaning</span>
            <span className="mt-1 block text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Adds a short summary and tags to each link you save, and finds links by what they&apos;re about, not just
              their words. When on, the text of the pages you save is sent to Anthropic and Voyage AI to do this.
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={!anyAvailable}
            onClick={() => onChange(!enabled)}
            className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition disabled:opacity-40 ${
              enabled ? "bg-sync-600" : "bg-slate-300 dark:bg-slate-700"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${enabled ? "left-[22px]" : "left-0.5"}`}
            />
          </button>
        </label>
        {!anyAvailable && (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Not available on this server yet.</p>
        )}
        {enabled && anyAvailable && (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Your saved links are being processed in the background. New links get a summary within a minute.
          </p>
        )}
      </div>
    </div>
  );
}

function Swatch({
  selected,
  onClick,
  label,
  style,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={selected}
      onClick={onClick}
      style={style}
      className={`flex h-12 items-center justify-center rounded-xl border transition ${
        selected
          ? "border-transparent ring-2 ring-sync-500 ring-offset-2 dark:ring-offset-slate-900"
          : "border-slate-900/10 hover:scale-[1.04] dark:border-white/10"
      }`}
    >
      {children}
    </button>
  );
}
