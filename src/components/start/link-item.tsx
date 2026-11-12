"use client";

import { useState } from "react";
import type { GroupLayout, ItemDTO } from "@/lib/start-page-types";
import { displayHost } from "@/lib/url";
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

  if (editing) {
    return (
      <form
        className="space-y-2 rounded-lg bg-zinc-100 p-2 dark:bg-zinc-800"
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
          <button type="button" className="btn-ghost ml-auto text-red-600" onClick={onDelete}>Delete</button>
        </div>
      </form>
    );
  }

  const actions = (
    <span className="absolute right-1 top-1 hidden gap-0.5 group-hover/item:flex group-focus-within/item:flex [@media(hover:none)]:flex">
      <IconButton label="Edit link" onClick={() => setEditing(true)}>✎</IconButton>
      <IconButton label="Delete link" onClick={onDelete}>✕</IconButton>
    </span>
  );

  if (layout === "tiles") {
    return (
      <div className="group/item relative">
        <a
          href={url}
          draggable={false}
          className="flex h-24 flex-col items-center justify-center gap-2 rounded-lg p-2 text-center hover:bg-zinc-100 dark:hover:bg-zinc-800"
          title={url}
        >
          <Favicon url={url} size={32} />
          <span className="line-clamp-2 w-full break-words text-xs">{label}</span>
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
        className="flex items-center gap-2 rounded-md px-2 py-1.5 pr-14 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        title={url}
      >
        <Favicon url={url} />
        <span className="truncate text-sm">{label}</span>
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
      className="flex h-6 w-6 items-center justify-center rounded bg-white/90 text-xs text-zinc-600 shadow-sm hover:text-zinc-900 dark:bg-zinc-700 dark:text-zinc-200"
    >
      {children}
    </button>
  );
}
