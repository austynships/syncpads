"use client";

import { useState } from "react";
import type { GroupLayout, ItemDTO } from "@/lib/start-page-types";
import { displayHost } from "@/lib/url";
import { IconPencil, IconX } from "@/components/icons";
import { Favicon } from "./favicon";

type Props = {
  item: ItemDTO;
  layout: GroupLayout;
  onSave: (fields: { url: string; title: string }) => void;
  onDelete: () => void;
};

export function LinkItem({ item, layout, onSave, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const url = item.url ?? "";
  const label = item.title || displayHost(url);
  // Hover text: the summary (when smart features made one), then the address.
  const tooltip = item.summary ? `${item.summary}

${url}` : url;

  if (editing) {
    return (
      <form
        className="space-y-2 rounded-xl border border-slate-900/[0.07] bg-slate-50 p-2.5 dark:border-white/10 dark:bg-slate-950/50"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          onSave({ url: String(form.get("url")), title: String(form.get("title")) });
          setEditing(false);
        }}
      >
        <input name="title" defaultValue={item.title ?? ""} placeholder="Title (optional)" className="field" autoFocus />
        <input name="url" defaultValue={url} placeholder="https://…" className="field" required />
        <div className="flex gap-2">
          <button type="submit" className="btn-primary">Save</button>
          <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
          <button type="button" className="btn-ghost ml-auto text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10" onClick={onDelete}>Delete</button>
        </div>
      </form>
    );
  }

  const actions = (
    <span className="absolute right-1 top-1 hidden gap-0.5 group-hover/item:flex group-focus-within/item:flex [@media(hover:none)]:flex">
      <IconButton label="Edit link" onClick={() => setEditing(true)}><IconPencil size={13} /></IconButton>
      <IconButton label="Delete link" onClick={onDelete}><IconX size={13} /></IconButton>
    </span>
  );

  if (layout === "tiles") {
    return (
      <div className="group/item relative">
        <a
          href={url}
          draggable={false}
          className="flex h-24 flex-col items-center justify-center gap-2 rounded-xl p-2 text-center transition hover:bg-slate-900/[0.04] dark:hover:bg-white/5"
          title={tooltip}
        >
          <Favicon url={url} size={32} />
          <span className="line-clamp-2 w-full break-words text-xs font-medium text-slate-700 dark:text-slate-300">{label}</span>
        </a>
        {actions}
      </div>
    );
  }

  return (
    <div className="group/item relative">
      <a
        href={url}
        draggable={false}
        className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 pr-14 transition hover:bg-slate-900/[0.04] dark:hover:bg-white/5"
        title={tooltip}
      >
        <Favicon url={url} />
        <span className="truncate text-sm text-slate-800 dark:text-slate-200">{label}</span>
      </a>
      {actions}
    </div>
  );
}

export function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-900/[0.07] bg-white text-slate-500 shadow-sm transition hover:text-slate-900 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-white"
    >
      {children}
    </button>
  );
}
