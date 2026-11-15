"use client";

import { useEffect, useRef, useState } from "react";
import { IconCheck, IconCopy, IconExternal, IconShare, IconX } from "@/components/icons";
import type { PageDTO, PageShareDTO } from "@/lib/start-page-types";
import { api } from "./api";

type Props = {
  page: PageDTO;
  onClose: () => void;
  /** Called after sharing changes, so the start page reloads its state. */
  onChanged: () => void;
  onError: (message: string) => void;
};

const linkFor = (token: string) => `${window.location.origin}/s/${token}`;

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Share a page: one click makes a link and copies it. Anyone with the link sees
 * the page read-only and can save a copy to their own SyncPads.
 */
export function ShareDialog({ page, onClose, onChanged, onError }: Props) {
  const [share, setShare] = useState<PageShareDTO | null>(page.share);
  const [includeNotes, setIncludeNotes] = useState(page.share?.includeNotes ?? false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const noteCount = page.groups.reduce((n, g) => n + g.items.filter((i) => i.type === "note").length, 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function copy(token: string) {
    const ok = await copyText(linkFor(token));
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      inputRef.current?.select(); // clipboard blocked: select it so Ctrl+C works
    }
  }

  async function update(body: { includeNotes?: boolean }, copyAfter = false) {
    setBusy(true);
    try {
      const res = await api<{ share: PageShareDTO }>("POST", `/api/pages/${page.id}/share`, body);
      setShare(res.share);
      setIncludeNotes(res.share.includeNotes);
      onChanged();
      if (copyAfter) await copy(res.share.token);
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    setBusy(true);
    try {
      await api("DELETE", `/api/pages/${page.id}/share`);
      setShare(null);
      setConfirmStop(false);
      setIncludeNotes(false);
      onChanged();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/30 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="share-title" className="truncate text-lg font-bold text-slate-900 dark:text-white">
              Share &ldquo;{page.name}&rdquo;
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Anyone with the link can view this page and save a copy. They can&apos;t change yours.
            </p>
          </div>
          <button type="button" className="icon-btn -mr-1 -mt-1" onClick={onClose} aria-label="Close">
            <IconX size={18} />
          </button>
        </div>

        {share ? (
          <>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                readOnly
                value={linkFor(share.token)}
                onFocus={(e) => e.currentTarget.select()}
                className="field min-w-0 flex-1 py-2 text-sm"
                aria-label="Share link"
              />
              <button type="button" className="btn-primary shrink-0" onClick={() => copy(share.token)}>
                {copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {canNativeShare && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => navigator.share({ title: page.name, url: linkFor(share.token) }).catch(() => {})}
                >
                  <IconShare size={15} />
                  Send…
                </button>
              )}
              <a href={`/s/${share.token}`} target="_blank" rel="noopener" className="btn-secondary">
                <IconExternal size={15} />
                Preview
              </a>
            </div>
            {share.copies > 0 && (
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                {share.copies === 1 ? "1 person has" : `${share.copies.toLocaleString()} people have`} saved a copy.
              </p>
            )}
          </>
        ) : (
          <button type="button" className="btn-primary w-full py-2.5" disabled={busy} onClick={() => update({ includeNotes }, true)}>
            <IconShare size={16} />
            {busy ? "Creating link…" : "Create link and copy it"}
          </button>
        )}

        <label className="mt-4 flex cursor-pointer items-start justify-between gap-4 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
          <span className="text-sm">
            <span className="block font-medium text-slate-900 dark:text-white">Include notes</span>
            <span className="text-slate-500 dark:text-slate-400">
              {noteCount === 0
                ? "This page has no notes right now."
                : "Off by default: notes can hold private details, including context your AI saved."}
            </span>
          </span>
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 shrink-0 accent-sync-600"
            checked={includeNotes}
            disabled={busy}
            onChange={(e) => (share ? update({ includeNotes: e.target.checked }) : setIncludeNotes(e.target.checked))}
          />
        </label>

        {share && (
          <div className="mt-4 border-t border-slate-900/[0.07] pt-4 dark:border-white/10">
            {confirmStop ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-slate-700 dark:text-slate-200">The link will stop working for everyone.</span>
                <span className="flex gap-2">
                  <button type="button" className="btn-ghost" onClick={() => setConfirmStop(false)}>
                    Cancel
                  </button>
                  <button type="button" className="btn-primary bg-red-600 hover:bg-red-700" disabled={busy} onClick={stop}>
                    Stop sharing
                  </button>
                </span>
              </div>
            ) : (
              <button type="button" className="text-sm font-medium text-red-600 hover:text-red-700" onClick={() => setConfirmStop(true)}>
                Stop sharing
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
