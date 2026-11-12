"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { ItemDTO } from "@/lib/start-page-types";
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
    <div className="group/item relative rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-950/40">
      {item.noteBody ? (
        <div
          className="note-content text-sm"
          onDoubleClick={() => setEditing(true)}
          dangerouslySetInnerHTML={{ __html: item.noteBody }}
        />
      ) : (
        <button type="button" className="text-sm text-zinc-500" onClick={() => setEditing(true)}>
          Empty note. Click to write.
        </button>
      )}
      <span className="absolute right-1 top-1 hidden gap-0.5 group-hover/item:flex group-focus-within/item:flex [@media(hover:none)]:flex">
        <IconButton label="Edit note" onClick={() => setEditing(true)}>✎</IconButton>
        <IconButton label="Delete note" onClick={onDelete}>✕</IconButton>
      </span>
    </div>
  );
}

