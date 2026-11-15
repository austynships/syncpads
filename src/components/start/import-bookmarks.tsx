"use client";

import { useState } from "react";
import { parseBookmarksHtml, planImport, type BookmarkNode } from "@/lib/bookmarks";
import { countFile, looksLikeSyncPadsFile, parseSyncPadsFile, type SyncPadsFile } from "@/lib/syncpads-file";
import { IconUpload } from "@/components/icons";
import { api } from "./api";

export type ImportResult = {
  revision: number;
  pageIds: string[];
  pages: number;
  groups: number;
  links: number;
  notes?: number;
  skipped: number;
};

type Pending =
  | { kind: "bookmarks"; tree: BookmarkNode[] }
  | { kind: "syncpads"; file: SyncPadsFile };

type Preview = { pages: string[]; groups: number; links: number; notes: number; skipped: number };

const MAX_FILE_BYTES = 50 * 1024 * 1024;

/**
 * Settings section: import a SyncPads export (.json, SP-10) or an HTML bookmark
 * file (SP-9) from Chrome, Edge, Firefox, Safari or start.me. The file is read
 * and previewed in the browser; only the pages, groups, links and notes are sent.
 */
export function ImportBookmarks({ onImported }: { onImported: (result: ImportResult) => void }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [busy, setBusy] = useState(false);

  function reset() {
    setPending(null);
    setPreview(null);
    setError(null);
    setUpgrade(false);
  }

  async function onFile(file: File | undefined) {
    reset();
    if (!file) return;
    setFileName(file.name);
    if (file.size > MAX_FILE_BYTES) return setError("That file is too big (over 50 MB).");
    try {
      const text = await file.text();
      if (file.name.toLowerCase().endsWith(".json") || text.trimStart().startsWith("{")) {
        let data: unknown;
        try {
          data = JSON.parse(text);
        } catch {
          return setError("That file isn't valid JSON. Pick a SyncPads export or an HTML bookmark file.");
        }
        if (!looksLikeSyncPadsFile(data)) return setError("That JSON file isn't a SyncPads export.");
        const parsed = parseSyncPadsFile(data);
        const c = countFile(parsed);
        if (c.links + c.notes === 0) return setError("That file has no links or notes to import.");
        setPending({ kind: "syncpads", file: parsed });
        setPreview({ pages: parsed.pages.map((p) => p.name), groups: c.groups, links: c.links, notes: c.notes, skipped: 0 });
      } else {
        const nodes = parseBookmarksHtml(text);
        const plan = planImport(nodes);
        if (plan.linkCount === 0) return setError("No links found. Pick a SyncPads export or an HTML bookmark file.");
        setPending({ kind: "bookmarks", tree: nodes });
        setPreview({ pages: plan.pages.map((p) => p.name), groups: plan.groupCount, links: plan.linkCount, notes: 0, skipped: plan.skipped });
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function runImport() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api<ImportResult>("POST", "/api/import", pending.kind === "syncpads" ? { file: pending.file } : { tree: pending.tree });
      setPending(null);
      setPreview(null);
      setFileName("");
      onImported(result);
    } catch (err) {
      setError((err as Error).message);
      setUpgrade((err as { upgrade?: boolean }).upgrade === true);
    } finally {
      setBusy(false);
    }
  }

  const plural = (n: number, one: string, many: string) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

  return (
    <div>
      <h3 className="label">Import</h3>
      <p className="mb-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        Upload a SyncPads export (.json), or an HTML bookmark file from Chrome, Edge, Firefox, Safari or start.me. Each page or
        top-level folder becomes a new page. Your current pages aren&apos;t changed.
      </p>
      <label className="btn-secondary cursor-pointer">
        <IconUpload size={15} />
        Choose file…
        <input
          type="file"
          accept=".json,application/json,.html,.htm,text/html"
          className="sr-only"
          onChange={(e) => {
            onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      {fileName && <span className="ml-2 text-xs text-slate-500">{fileName}</span>}

      {preview && (
        <div className="mt-3 rounded-xl border border-slate-900/10 bg-slate-50 p-4 text-sm dark:border-white/10 dark:bg-slate-950/40">
          <p>
            Ready to import <strong>{plural(preview.links, "link", "links")}</strong>
            {preview.notes > 0 && (
              <>
                {" "}
                and <strong>{plural(preview.notes, "note", "notes")}</strong>
              </>
            )}{" "}
            into <strong>{plural(preview.pages.length, "new page", "new pages")}</strong> and{" "}
            <strong>{plural(preview.groups, "group", "groups")}</strong>.
          </p>
          {preview.skipped > 0 && (
            <p className="mt-1 text-xs text-slate-500">{preview.skipped} entries aren&apos;t web links and will be skipped.</p>
          )}
          <p className="mt-1 truncate text-xs text-slate-500">New pages: {preview.pages.join(", ")}</p>
          <button type="button" className="btn-primary mt-3 w-full" disabled={busy} onClick={runImport}>
            {busy ? "Importing…" : "Import"}
          </button>
        </div>
      )}
      {error && (
        <p className="mt-2 text-sm text-red-600">
          {error}{" "}
          {upgrade && (
            <a href="/pricing" className="font-semibold text-slate-900 underline decoration-sync-500 underline-offset-2 dark:text-white">
              See plans
            </a>
          )}
        </p>
      )}
    </div>
  );
}

/** Settings section: download all pages or just this one, as a SyncPads file or browser bookmarks. */
export function ExportPages({ page }: { page: { id: string; name: string } }) {
  const [scope, setScope] = useState<"all" | "page">("all");
  const href = (format: "json" | "html") => `/api/export?format=${format}${scope === "page" ? `&pageId=${encodeURIComponent(page.id)}` : ""}`;

  return (
    <div>
      <h3 className="label">Export</h3>
      <p className="mb-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        Keep a backup or move your pages somewhere else. The SyncPads file has everything, notes included, and imports back
        exactly. Browser bookmarks work in Chrome, Edge, Firefox and Safari, but leave out notes.
      </p>
      <div className="mb-3 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm font-semibold dark:bg-white/5" role="radiogroup" aria-label="What to export">
        {(
          [
            ["all", "All pages"],
            ["page", `This page (${page.name})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={scope === id}
            onClick={() => setScope(id)}
            className={`min-w-0 flex-1 truncate rounded-md px-3 py-1.5 transition ${
              scope === id
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid gap-2">
        <a href={href("json")} download className="btn-secondary justify-center">
          SyncPads file (.json)
        </a>
        <a href={href("html")} download className="btn-secondary justify-center">
          Browser bookmarks (.html)
        </a>
      </div>
    </div>
  );
}
