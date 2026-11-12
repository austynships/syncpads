"use client";

import { useState } from "react";
import type { Wallpaper } from "@/db/schema";
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
  onPageLayout: (layout: PageLayout) => void;
  onRenamePage: (name: string) => void;
  onDeletePage: () => void;
  onImported: (result: { pageIds: string[]; links: number; pages: number }) => void;
};

/** Appearance (SP-5) and current-page settings, in a side panel. */
export function SettingsPanel(p: Props) {
  const [imageUrl, setImageUrl] = useState(p.settings.wallpaper.type === "url" ? p.settings.wallpaper.value : "");
  const wp = p.settings.wallpaper;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20" onClick={p.onClose}>
      <aside
        className="h-full w-full max-w-sm overflow-y-auto bg-white p-5 shadow-2xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
        aria-label="Settings"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button type="button" className="btn-ghost" onClick={p.onClose} aria-label="Close">✕</button>
        </div>

        <h3 className="label">Theme</h3>
        <div className="mb-6 grid grid-cols-3 gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
          {(["system", "light", "dark"] as Theme[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => p.onTheme(t)}
              className={`rounded-md py-1.5 text-sm capitalize ${
                p.settings.theme === t ? "bg-white shadow-sm dark:bg-zinc-700" : "text-zinc-600 dark:text-zinc-300"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <h3 className="label">Wallpaper</h3>
        <div className="mb-3 grid grid-cols-4 gap-2">
          <Swatch selected={wp.type === "none"} onClick={() => p.onWallpaper({ type: "none" })} label="None">
            <span className="text-xs text-zinc-500">None</span>
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
          className="mb-6 flex gap-2"
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
          />
          <button type="submit" className="btn-primary shrink-0">Use</button>
        </form>

        <ImportBookmarks onImported={p.onImported} />

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
          <button type="submit" className="btn-ghost shrink-0">Rename</button>
        </form>
        <label className="mb-4 flex items-center justify-between gap-2 text-sm">
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
        <button
          type="button"
          disabled={!p.canDeletePage}
          title={p.canDeletePage ? undefined : "You need at least one page"}
          className="btn-ghost w-full text-red-600 disabled:opacity-40"
          onClick={() => {
            if (confirm(`Delete the page "${p.page.name}" and everything on it?`)) p.onDeletePage();
          }}
        >
          Delete this page
        </button>

        <p className="mt-8 text-xs text-zinc-500">
          Tip: paste a link anywhere on the page to add it to the first group.
        </p>
      </aside>
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
      onClick={onClick}
      style={style}
      className={`flex h-12 items-center justify-center rounded-lg border ${
        selected ? "ring-2 ring-sky-500 ring-offset-2 dark:ring-offset-zinc-900" : "border-zinc-200 dark:border-zinc-700"
      }`}
    >
      {children}
    </button>
  );
}

