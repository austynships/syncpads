"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconBot, IconCheck, IconInbox, IconX } from "@/components/icons";
import type { InboxItemDTO, PageDTO } from "@/lib/start-page-types";
import { displayHost } from "@/lib/url";
import { Favicon } from "./favicon";

type Props = {
  inbox: InboxItemDTO[];
  pages: PageDTO[];
  onClose: () => void;
  onApprove: (item: InboxItemDTO, groupId: string, title: string) => void;
  onDismiss: (item: InboxItemDTO) => void;
};

/** Agent Inbox (SP-16): links agents suggested, waiting for the user's decision. */
export function InboxPanel({ inbox, pages, onClose, onApprove, onDismiss }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/30 backdrop-blur-[2px]" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Agent Inbox"
      >
        <header className="flex items-center justify-between border-b border-slate-900/[0.07] px-6 py-4 dark:border-white/10">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Agent Inbox</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Links your connected agents suggested. Nothing is added until you approve it.</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close inbox">
            <IconX size={18} />
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
          {inbox.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300">
                <IconInbox size={22} />
              </span>
              <p className="mt-4 font-semibold text-slate-900 dark:text-white">You&apos;re all caught up</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                When an agent suggests a link, it shows up here for you to review.
              </p>
              <Link href="/agents" className="btn-secondary mt-5">
                <IconBot size={15} />
                Connect an agent
              </Link>
            </div>
          ) : (
            inbox.map((item) => (
              <InboxCard key={item.id} item={item} pages={pages} onApprove={onApprove} onDismiss={onDismiss} />
            ))
          )}
        </div>

        <footer className="border-t border-slate-900/[0.07] px-6 py-4 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
          <Link href="/agents" className="font-semibold text-slate-700 underline-offset-2 hover:underline dark:text-slate-200">
            Agents and activity
          </Link>{" "}
          — change what each agent may do, or undo its actions.
        </footer>
      </aside>
    </div>
  );
}

function InboxCard({
  item,
  pages,
  onApprove,
  onDismiss,
}: {
  item: InboxItemDTO;
  pages: PageDTO[];
  onApprove: Props["onApprove"];
  onDismiss: Props["onDismiss"];
}) {
  const [title, setTitle] = useState(item.title ?? "");
  const [groupId, setGroupId] = useState(item.groupId);
  const host = item.url ? displayHost(item.url) : "";

  return (
    <article className="rounded-2xl border border-slate-900/[0.08] p-4 dark:border-white/10">
      <div className="flex items-start gap-3">
        <span className="mt-0.5">
          <Favicon url={item.url} size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <a href={item.url ?? "#"} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-semibold text-slate-900 hover:underline dark:text-white">
            {item.title || host}
          </a>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{host}</p>
        </div>
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
        <IconBot size={14} className="text-sync-600 dark:text-sync-400" />
        {item.agentName} · {new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
      </p>
      {(item.reason || item.note) && (
        <p className="mt-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-700 dark:bg-white/5 dark:text-slate-300">
          {item.reason}
          {item.reason && item.note ? " " : ""}
          {item.note}
        </p>
      )}
      {item.summary && <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{item.summary}</p>}

      <div className="mt-3 space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          className="field"
          aria-label="Title"
        />
        <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="field" aria-label="Add to group">
          {pages.map((p) => (
            <optgroup key={p.id} label={p.name}>
              {p.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {p.name} › {g.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" className="btn-secondary" onClick={() => onDismiss(item)}>
          <IconX size={14} />
          Dismiss
        </button>
        <button type="button" className="btn-primary" onClick={() => onApprove(item, groupId, title)}>
          <IconCheck size={14} />
          Approve
        </button>
      </div>
    </article>
  );
}
