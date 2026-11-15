"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconCheck, IconCopy, IconExternal, IconShare, IconUsers, IconX } from "@/components/icons";
import type { PageDTO, PageShareDTO } from "@/lib/start-page-types";
import { api } from "./api";

type Props = {
  page: PageDTO;
  onClose: () => void;
  /** Called after sharing changes, so the start page reloads its state. */
  onChanged: () => void;
  onError: (message: string) => void;
  onLeave: () => void;
};

type Editor = { userId: string; name: string; email: string };

const linkFor = (token: string) => `${window.location.origin}/s/${token}`;

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** The link box with Copy, plus Send (phones) and Preview. */
function LinkBox({ token, title }: { token: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function copy() {
    if (await copyText(linkFor(token))) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      inputRef.current?.select(); // clipboard blocked: select it so Ctrl+C works
    }
  }

  return (
    <>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          readOnly
          value={linkFor(token)}
          onFocus={(e) => e.currentTarget.select()}
          className="field min-w-0 flex-1 py-2 text-sm"
          aria-label="Share link"
        />
        <button type="button" className="btn-primary shrink-0" onClick={copy}>
          {copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {canNativeShare && (
          <button type="button" className="btn-secondary" onClick={() => navigator.share({ title, url: linkFor(token) }).catch(() => {})}>
            <IconShare size={15} />
            Send…
          </button>
        )}
        <a href={`/s/${token}`} target="_blank" rel="noopener" className="btn-secondary">
          <IconExternal size={15} />
          Preview
        </a>
      </div>
    </>
  );
}

function Shell({ title, subtitle, onClose, children }: { title: string; subtitle: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/30 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="share-title" className="truncate text-lg font-bold text-slate-900 dark:text-white">
              {title}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          </div>
          <button type="button" className="icon-btn -mr-1 -mt-1" onClick={onClose} aria-label="Close">
            <IconX size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * Share a page. Owners: one click makes a link and copies it, and they choose
 * whether people with the link can view or edit. Editors (someone else's page):
 * they can pass the edit link on, or leave the page.
 */
export function ShareDialog(props: Props) {
  return props.page.access === "editor" ? <EditorView {...props} /> : <OwnerView {...props} />;
}

function EditorView({ page, onClose, onLeave }: Props) {
  const [confirmLeave, setConfirmLeave] = useState(false);
  return (
    <Shell title={`“${page.name}”`} subtitle={<>Shared with you by {page.ownerName}. You can edit it, and changes show up for everyone on it.</>} onClose={onClose}>
      {page.share?.role === "edit" ? (
        <>
          <p className="mb-2 text-sm font-medium text-slate-900 dark:text-white">Invite someone else to edit</p>
          <LinkBox token={page.share.token} title={page.name} />
        </>
      ) : (
        <p className="text-sm text-slate-600 dark:text-slate-300">Only {page.ownerName} can invite more people to this page.</p>
      )}
      <div className="mt-4 border-t border-slate-900/[0.07] pt-4 dark:border-white/10">
        {confirmLeave ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-slate-700 dark:text-slate-200">It disappears from your SyncPads. {page.ownerName} keeps it.</span>
            <span className="flex gap-2">
              <button type="button" className="btn-ghost" onClick={() => setConfirmLeave(false)}>
                Cancel
              </button>
              <button type="button" className="btn-primary bg-red-600 hover:bg-red-700" onClick={onLeave}>
                Leave page
              </button>
            </span>
          </div>
        ) : (
          <button type="button" className="text-sm font-medium text-red-600 hover:text-red-700" onClick={() => setConfirmLeave(true)}>
            Leave this page
          </button>
        )}
      </div>
    </Shell>
  );
}

function OwnerView({ page, onClose, onChanged, onError }: Props) {
  const [share, setShare] = useState<PageShareDTO | null>(page.share);
  const [role, setRole] = useState<"view" | "edit">(page.share?.role ?? "view");
  const [includeNotes, setIncludeNotes] = useState(page.share?.includeNotes ?? false);
  const [editors, setEditors] = useState<Editor[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<"stop" | "view" | null>(null);
  const noteCount = page.groups.reduce((n, g) => n + g.items.filter((i) => i.type === "note").length, 0);

  const loadEditors = useCallback(async () => {
    try {
      setEditors((await api<{ editors: Editor[] }>("GET", `/api/pages/${page.id}/editors`)).editors);
    } catch {
      setEditors([]);
    }
  }, [page.id]);

  useEffect(() => {
    if (share?.role === "edit") void loadEditors();
  }, [share?.role, share?.editors, loadEditors]);

  async function update(body: { includeNotes?: boolean; role?: "view" | "edit" }, copyAfter = false) {
    setBusy(true);
    try {
      const res = await api<{ share: PageShareDTO }>("POST", `/api/pages/${page.id}/share`, body);
      setShare(res.share);
      setRole(res.share.role);
      setIncludeNotes(res.share.includeNotes);
      if (res.share.role === "view") setEditors(null);
      onChanged();
      if (copyAfter) await copyText(linkFor(res.share.token));
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  async function stop() {
    setBusy(true);
    try {
      await api("DELETE", `/api/pages/${page.id}/share`);
      setShare(null);
      setEditors(null);
      setRole("view");
      setIncludeNotes(false);
      onChanged();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  async function remove(editor: Editor) {
    try {
      await api("DELETE", `/api/pages/${page.id}/editors`, { userId: editor.userId });
      setEditors((list) => list?.filter((e) => e.userId !== editor.userId) ?? null);
      onChanged();
    } catch (err) {
      onError((err as Error).message);
    }
  }

  const editorCount = editors?.length ?? share?.editors ?? 0;

  function pickRole(next: "view" | "edit") {
    if (next === role) return;
    if (!share) return setRole(next);
    if (next === "view" && editorCount > 0) return setConfirm("view");
    void update({ role: next });
  }

  return (
    <Shell title={`Share “${page.name}”`} subtitle="Send the link to anyone. You decide whether they can view the page or edit it." onClose={onClose}>
      <p className="mb-2 text-sm font-medium text-slate-900 dark:text-white">Anyone with the link can</p>
      <div className="mb-2 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm font-semibold dark:bg-white/5" role="radiogroup" aria-label="Link access">
        {(
          [
            ["view", "View"],
            ["edit", "Edit"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={role === id}
            disabled={busy}
            onClick={() => pickRole(id)}
            className={`flex-1 rounded-md px-3 py-1.5 transition ${
              role === id
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mb-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {role === "edit"
          ? "They sign in, and the page shows up in their SyncPads. They can change everything on it, including notes, and you see their changes."
          : "They see a read-only copy of the page and can save their own copy. They can't change yours."}
      </p>

      {confirm === "view" && (
        <div className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-400/10 dark:text-amber-200">
          {editorCount === 1 ? "1 person" : `${editorCount} people`} will lose access to edit this page.
          <span className="mt-2 flex gap-2">
            <button type="button" className="btn-ghost" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" disabled={busy} onClick={() => update({ role: "view" })}>
              Make it view only
            </button>
          </span>
        </div>
      )}

      {share ? (
        <LinkBox token={share.token} title={page.name} />
      ) : (
        <button type="button" className="btn-primary w-full py-2.5" disabled={busy} onClick={() => update({ includeNotes, role }, true)}>
          <IconShare size={16} />
          {busy ? "Creating link…" : "Create link and copy it"}
        </button>
      )}

      {share?.role === "edit" && (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-900 dark:text-white">
            <IconUsers size={15} />
            People who can edit
          </p>
          {editors === null ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : editors.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Nobody yet. Send the link and they&apos;ll appear here once they join.</p>
          ) : (
            <ul className="divide-y divide-slate-900/[0.06] rounded-xl border border-slate-900/[0.07] dark:divide-white/10 dark:border-white/10">
              {editors.map((e) => (
                <li key={e.userId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-900 dark:text-white">{e.name}</span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{e.email}</span>
                  </span>
                  <button type="button" className="shrink-0 text-xs font-medium text-red-600 hover:text-red-700" onClick={() => remove(e)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <label className="mt-4 flex cursor-pointer items-start justify-between gap-4 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
        <span className="text-sm">
          <span className="block font-medium text-slate-900 dark:text-white">
            {role === "edit" ? "Show notes to people who only view" : "Include notes"}
          </span>
          <span className="text-slate-500 dark:text-slate-400">
            {noteCount === 0
              ? "This page has no notes right now."
              : role === "edit"
                ? "People who join to edit always see notes. This is for anyone who opens the link without joining."
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

      {share && share.copies > 0 && (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          {share.copies === 1 ? "1 person has" : `${share.copies.toLocaleString()} people have`} saved a copy.
        </p>
      )}

      {share && (
        <div className="mt-4 border-t border-slate-900/[0.07] pt-4 dark:border-white/10">
          {confirm === "stop" ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-slate-700 dark:text-slate-200">
                The link stops working{editorCount > 0 ? " and editors lose access" : ""}.
              </span>
              <span className="flex gap-2">
                <button type="button" className="btn-ghost" onClick={() => setConfirm(null)}>
                  Cancel
                </button>
                <button type="button" className="btn-primary bg-red-600 hover:bg-red-700" disabled={busy} onClick={stop}>
                  Stop sharing
                </button>
              </span>
            </div>
          ) : (
            <button type="button" className="text-sm font-medium text-red-600 hover:text-red-700" onClick={() => setConfirm("stop")}>
              Stop sharing
            </button>
          )}
        </div>
      )}
    </Shell>
  );
}
