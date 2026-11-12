"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { ItemDTO } from "@/lib/start-page-types";
import { IconPencil, IconX } from "@/components/icons";
import { IconButton } from "./link-item";

// The editor is only loaded when someone edits a note.
const NoteEditor = dynamic(() => import("./note-editor").then((m) => m.NoteEditor), { ssr: false });

type Props = {
  item: ItemDTO;
  startEditing?: boolean;
  onSave: (noteBody: string) => void;
  onDelete: () => void;
};

/** A note inside a group (SP-11). The HTML was sanitized by the server before it was stored. */
export function NoteItem({ item, startEditing = false, onSave, onDelete }: Props) {
  const [editing, setEditing] = useState(startEditing);

  if (editing) {
    return (
      <NoteEditor
        initialHtml={item.noteBody ?? ""}
        onDone={(html) => {
          setEditing(false);
          if (html !== (item.noteBody ?? "")) onSave(html);
        }}
      />
    );
  }

  return (
    <div className="group/item relative rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2.5 text-slate-800 dark:border-blue-400/15 dark:bg-blue-400/10 dark:text-slate-200">
      {item.noteBody ? (
        <div
          className="note-content text-sm"
          onDoubleClick={() => setEditing(true)}
          dangerouslySetInnerHTML={{ __html: item.noteBody }}
        />
      ) : (
        <button type="button" className="text-sm text-slate-500" onClick={() => setEditing(true)}>
          Empty note. Click to write.
        </button>
      )}
      <span className="absolute right-1 top-1 hidden gap-0.5 group-hover/item:flex group-focus-within/item:flex [@media(hover:none)]:flex">
        <IconButton label="Edit note" onClick={() => setEditing(true)}><IconPencil size={13} /></IconButton>
        <IconButton label="Delete note" onClick={onDelete}><IconX size={13} /></IconButton>
      </span>
    </div>
  );
}

