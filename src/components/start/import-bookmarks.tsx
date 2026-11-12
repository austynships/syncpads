"use client";

import { useState } from "react";
import { parseBookmarksHtml, planImport, type BookmarkNode, type ImportPlan } from "@/lib/bookmarks";
import { api } from "./api";

type ImportResult = { revision: number; pageIds: string[]; pages: number; groups: number; links: number; skipped: number };

const MAX_FILE_BYTES = 50 * 1024 * 1024;

/**
 * Settings section: import an HTML bookmark file (SP-9).
 * Works with exports from Chrome, Edge, Firefox, Safari and start.me.
 * The file is read and previewed in the browser; only the folders and links are sent.
 */
export function ImportBookmarks({ onImported }: { onImported: (result: ImportResult) => void }) {
  const [tree, setTree] = useState<BookmarkNode[] | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    setTree(null);
    setPlan(null);
    setError(null);
    if (!file) return;
    setFileName(file.name);
    if (file.size > MAX_FILE_BYTES) return setError("That file is too big (over 50 MB).");
    try {
      const nodes = parseBookmarksHtml(await file.text());
      const preview = planImport(nodes);
      if (preview.linkCount === 0) return setError("No links found. Pick an HTML bookmark export.");
      setTree(nodes);
      setPlan(preview);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function runImport() {
    if (!tree) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api<ImportResult>("POST", "/api/import", { tree });
      setTree(null);
      setPlan(null);
      setFileName("");
      onImported(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6">
      <h3 className="label">Import bookmarks</h3>
      <p className="mb-2 text-xs text-zinc-500">
        Upload an HTML bookmark export from Chrome, Edge, Firefox, Safari or start.me. Each top-level folder
        becomes a page and each subfolder a group. Your current pages aren&apos;t changed.
      </p>
      <label className="btn-ghost inline-block cursor-pointer border border-zinc-300 dark:border-zinc-600">
        Choose file…
        <input
          type="file"
          accept=".html,.htm,text/html"
          className="sr-only"
          onChange={(e) => {
            onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      {fileName && <span className="ml-2 text-xs text-zinc-500">{fileName}</span>}

      {plan && (
        <div className="mt-3 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-700">
          <p>
            Ready to import <strong>{plan.linkCount.toLocaleString()}</strong> links into{" "}
            <strong>{plan.pages.length}</strong> {plan.pages.length === 1 ? "page" : "pages"} and{" "}
            <strong>{plan.groupCount}</strong> {plan.groupCount === 1 ? "group" : "groups"}.
          </p>
          {plan.skipped > 0 && (
            <p className="mt-1 text-xs text-zinc-500">{plan.skipped} entries aren&apos;t web links and will be skipped.</p>
          )}
          <p className="mt-1 truncate text-xs text-zinc-500">
            New pages: {plan.pages.map((p) => p.name).join(", ")}
          </p>
          <button type="button" className="btn-primary mt-3 w-full" disabled={busy} onClick={runImport}>
            {busy ? "Importing…" : "Import"}
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
