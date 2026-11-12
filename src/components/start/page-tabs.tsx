"use client";

import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, horizontalListSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { IconPlus } from "@/components/icons";
import type { PageDTO } from "@/lib/start-page-types";

type Props = {
  pages: PageDTO[];
  currentId: string;
  onSelect: (id: string) => void;
  onAdd: (name: string) => void;
  onReorder: (ids: string[]) => void;
  onRename: (id: string, name: string) => void;
};

/** Page tabs (SP-3): click to switch, drag to reorder, double-click to rename. */
export function PageTabs({ pages, currentId, onSelect, onAdd, onReorder, onRename }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [adding, setAdding] = useState(false);

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = pages.map((p) => p.id);
    onReorder(arrayMove(ids, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id))));
  }

  return (
    <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-2" aria-label="Pages">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={pages.map((p) => p.id)} strategy={horizontalListSortingStrategy}>
          {pages.map((p) => (
            <Tab key={p.id} page={p} active={p.id === currentId} onSelect={onSelect} onRename={onRename} />
          ))}
        </SortableContext>
      </DndContext>
      {adding ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const name = String(new FormData(e.currentTarget).get("name")).trim();
            if (name) onAdd(name);
            setAdding(false);
          }}
        >
          <input
            name="name"
            placeholder="Page name"
            autoFocus
            className="field w-36 py-1"
            onBlur={(e) => (e.currentTarget.value.trim() ? e.currentTarget.form?.requestSubmit() : setAdding(false))}
          />
        </form>
      ) : (
        <button type="button" className="icon-btn shrink-0" onClick={() => setAdding(true)} aria-label="Add page" title="Add page">
          <IconPlus size={16} />
        </button>
      )}
    </nav>
  );
}

function Tab({
  page,
  active,
  onSelect,
  onRename,
}: {
  page: PageDTO;
  active: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
}) {
  const s = useSortable({ id: page.id });
  const [renaming, setRenaming] = useState(false);

  return (
    <div
      ref={s.setNodeRef}
      style={{ transform: CSS.Translate.toString(s.transform), transition: s.transition }}
      className="shrink-0"
      {...s.attributes}
      {...s.listeners}
    >
      {renaming ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const name = String(new FormData(e.currentTarget).get("name")).trim();
            if (name && name !== page.name) onRename(page.id, name);
            setRenaming(false);
          }}
        >
          <input
            name="name"
            defaultValue={page.name}
            autoFocus
            className="field w-36 py-1"
            onKeyDown={(e) => e.stopPropagation()}
            onBlur={(e) => e.currentTarget.form?.requestSubmit()}
          />
        </form>
      ) : (
        <button
          type="button"
          className={`tab ${active ? "tab-active" : ""}`}
          onClick={() => onSelect(page.id)}
          onDoubleClick={() => setRenaming(true)}
          title="Double-click to rename, drag to reorder"
        >
          {page.name}
        </button>
      )}
    </div>
  );
}

