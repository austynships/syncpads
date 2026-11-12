"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRef, useState } from "react";
import type { GroupDTO, GroupLayout, ItemDTO, PageDTO, PageLayout } from "@/lib/start-page-types";
import { displayHost } from "@/lib/url";
import { Favicon } from "./favicon";
import { IconButton, LinkItem } from "./link-item";
import { NoteItem } from "./note-item";

export type BoardActions = {
  addGroup: (pageId: string, name: string) => void;
  renameGroup: (groupId: string, name: string) => void;
  setGroupLayout: (groupId: string, layout: GroupLayout) => void;
  deleteGroup: (groupId: string) => void;
  addLink: (groupId: string, url: string, title: string) => Promise<boolean>;
  addNote: (groupId: string) => Promise<string | null>;
  saveLink: (itemId: string, fields: { url: string; title: string }) => void;
  saveNote: (itemId: string, noteBody: string) => void;
  deleteItem: (itemId: string) => void;
  commitDrag: (pageId: string, groups: GroupDTO[], change: { groupsMoved: boolean; itemGroupIds: string[] }) => void;
};

const COLUMNS: Record<PageLayout, string> = {
  auto: "grid-cols-[repeat(auto-fill,minmax(17rem,1fr))]",
  "1": "grid-cols-1 max-w-2xl mx-auto",
  "2": "grid-cols-1 md:grid-cols-2",
  "3": "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  "4": "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  "5": "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5",
};

type DragData = { type: "group"; groupId: string } | { type: "item"; itemId: string; groupId: string } | { type: "drop"; groupId: string };

const groupKey = (id: string) => `group:${id}`;
const itemKey = (id: string) => `item:${id}`;

export function PageBoard({ page, actions }: { page: PageDTO; actions: BoardActions }) {
  // While dragging we work on a copy, so the drop can be saved in one go.
  const [working, setWorking] = useState<GroupDTO[] | null>(null);
  const [active, setActive] = useState<DragData | null>(null);
  const startGroup = useRef<string | null>(null);
  const groups = working ?? page.groups;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const groupOf = (gs: GroupDTO[], itemId: string) => gs.find((g) => g.items.some((i) => i.id === itemId));
  const targetGroupId = (data: DragData | undefined) => (data ? data.groupId : null);

  function onDragStart(e: DragStartEvent) {
    const data = e.active.data.current as DragData;
    setActive(data);
    setWorking(structuredClone(page.groups));
    startGroup.current = data.type === "item" ? data.groupId : null;
  }

  // Moving an item into another group happens live, while hovering.
  function onDragOver(e: DragOverEvent) {
    const a = e.active.data.current as DragData;
    const over = e.over?.data.current as DragData | undefined;
    if (a?.type !== "item" || !over || !working) return;
    const from = groupOf(working, a.itemId);
    const toId = targetGroupId(over);
    if (!from || !toId || from.id === toId) return;

    setWorking((gs) => {
      if (!gs) return gs;
      const source = gs.find((g) => g.id === from.id)!;
      const item = source.items.find((i) => i.id === a.itemId)!;
      return gs.map((g) => {
        if (g.id === from.id) return { ...g, items: g.items.filter((i) => i.id !== a.itemId) };
        if (g.id === toId) {
          const index = over.type === "item" ? g.items.findIndex((i) => i.id === over.itemId) : -1;
          const next = [...g.items];
          next.splice(index >= 0 ? index : next.length, 0, item);
          return { ...g, items: next };
        }
        return g;
      });
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const a = e.active.data.current as DragData;
    const over = e.over?.data.current as DragData | undefined;
    let final = working ?? page.groups;
    let groupsMoved = false;
    const itemGroupIds = new Set<string>();

    if (a?.type === "group" && over) {
      const from = final.findIndex((g) => g.id === a.groupId);
      const to = final.findIndex((g) => g.id === targetGroupId(over));
      if (from >= 0 && to >= 0 && from !== to) {
        final = arrayMove(final, from, to);
        groupsMoved = true;
      }
    }

    if (a?.type === "item") {
      const group = groupOf(final, a.itemId);
      if (group && over?.type === "item" && over.itemId !== a.itemId) {
        const from = group.items.findIndex((i) => i.id === a.itemId);
        const to = group.items.findIndex((i) => i.id === over.itemId);
        if (to >= 0) {
          final = final.map((g) => (g.id === group.id ? { ...g, items: arrayMove(g.items, from, to) } : g));
        }
      }
      const orderChanged = (gid: string) => {
        const before = page.groups.find((g) => g.id === gid)?.items.map((i) => i.id).join() ?? "";
        const after = final.find((g) => g.id === gid)?.items.map((i) => i.id).join() ?? "";
        return before !== after;
      };
      for (const gid of [startGroup.current, group?.id]) {
        if (gid && orderChanged(gid)) itemGroupIds.add(gid);
      }
    }

    if (groupsMoved || itemGroupIds.size > 0) {
      actions.commitDrag(page.id, final, { groupsMoved, itemGroupIds: [...itemGroupIds] });
    }
    setWorking(null);
    setActive(null);
  }

  const activeItem =
    active?.type === "item" ? groups.flatMap((g) => g.items).find((i) => i.id === active.itemId) : undefined;
  const activeGroup = active?.type === "group" ? groups.find((g) => g.id === active.groupId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setWorking(null);
        setActive(null);
      }}
    >
      <SortableContext items={groups.map((g) => groupKey(g.id))} strategy={rectSortingStrategy}>
        <div className={`grid items-start gap-4 ${COLUMNS[page.layout] ?? COLUMNS.auto}`}>
          {groups.map((g) => (
            <GroupCard key={g.id} group={g} actions={actions} />
          ))}
          <AddGroup onAdd={(name) => actions.addGroup(page.id, name)} />
        </div>
      </SortableContext>
      <DragOverlay>
        {activeItem ? <DragPreview item={activeItem} /> : null}
        {activeGroup ? (
          <div className="card px-4 py-3 font-semibold shadow-xl">{activeGroup.name}</div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function DragPreview({ item }: { item: ItemDTO }) {
  return (
    <div className="card flex items-center gap-2 px-3 py-2 text-sm shadow-xl">
      {item.type === "link" ? <Favicon url={item.url} /> : <span>📝</span>}
      <span className="max-w-56 truncate">
        {item.type === "link" ? item.title || displayHost(item.url ?? "") : "Note"}
      </span>
    </div>
  );
}

function GroupCard({ group, actions }: { group: GroupDTO; actions: BoardActions }) {
  const sortable = useSortable({ id: groupKey(group.id), data: { type: "group", groupId: group.id } satisfies DragData });
  const droppable = useDroppable({ id: `drop:${group.id}`, data: { type: "drop", groupId: group.id } satisfies DragData });
  const [renaming, setRenaming] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newNoteId, setNewNoteId] = useState<string | null>(null);

  const style = { transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition };
  const tiles = group.layout === "tiles";

  return (
    <section
      ref={sortable.setNodeRef}
      style={style}
      className={`card p-3 ${sortable.isDragging ? "opacity-40" : ""}`}
    >
      <header className="group/header mb-2 flex items-center gap-1">
        <button
          type="button"
          className="cursor-grab touch-none px-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          aria-label="Drag group"
          {...sortable.attributes}
          {...sortable.listeners}
        >
          ⠿
        </button>
        {renaming ? (
          <form
            className="flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              const name = String(new FormData(e.currentTarget).get("name")).trim();
              if (name && name !== group.name) actions.renameGroup(group.id, name);
              setRenaming(false);
            }}
          >
            <input
              name="name"
              defaultValue={group.name}
              autoFocus
              className="field py-0.5"
              onBlur={(e) => e.currentTarget.form?.requestSubmit()}
            />
          </form>
        ) : (
          <h2
            className="flex-1 cursor-text truncate font-semibold"
            onClick={() => setRenaming(true)}
            title="Click to rename"
          >
            {group.name}
          </h2>
        )}
        <span className="hidden gap-0.5 group-hover/header:flex group-focus-within/header:flex [@media(hover:none)]:flex">
          <IconButton
            label={tiles ? "Show as list" : "Show as tiles"}
            onClick={() => actions.setGroupLayout(group.id, tiles ? "list" : "tiles")}
          >
            {tiles ? "☰" : "▦"}
          </IconButton>
          <IconButton
            label="Delete group"
            onClick={() => {
              const count = group.items.length;
              if (count === 0 || confirm(`Delete "${group.name}" and its ${count} item${count === 1 ? "" : "s"}?`)) {
                actions.deleteGroup(group.id);
              }
            }}
          >
            ✕
          </IconButton>
        </span>
      </header>

      <SortableContext
        items={group.items.map((i) => itemKey(i.id))}
        strategy={tiles ? rectSortingStrategy : verticalListSortingStrategy}
      >
        <div
          ref={droppable.setNodeRef}
          className={`min-h-10 rounded-md ${droppable.isOver ? "bg-sky-50 dark:bg-sky-950/30" : ""} ${
            tiles ? "grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-1" : "flex flex-col gap-0.5"
          }`}
        >
          {group.items.map((item) => (
            <SortableItem key={item.id} item={item} groupId={group.id} tiles={tiles && item.type === "link"}>
              {item.type === "link" ? (
                <LinkItem
                  item={item}
                  layout={group.layout}
                  onSave={(fields) => actions.saveLink(item.id, fields)}
                  onDelete={() => actions.deleteItem(item.id)}
                />
              ) : (
                <NoteItem
                  item={item}
                  startEditing={item.id === newNoteId}
                  onSave={(html) => actions.saveNote(item.id, html)}
                  onDelete={() => actions.deleteItem(item.id)}
                />
              )}
            </SortableItem>
          ))}
          {group.items.length === 0 && !adding && (
            <p className="col-span-full px-2 py-3 text-center text-xs text-zinc-500">
              Drop links here, or paste a URL anywhere on the page.
            </p>
          )}
        </div>
      </SortableContext>

      {adding ? (
        <AddLinkForm
          onCancel={() => setAdding(false)}
          onAdd={async (url, title) => {
            if (await actions.addLink(group.id, url, title)) setAdding(false);
          }}
        />
      ) : (
        <div className="mt-2 flex gap-1">
          <button type="button" className="btn-ghost text-xs" onClick={() => setAdding(true)}>+ Link</button>
          <button
            type="button"
            className="btn-ghost text-xs"
            onClick={async () => setNewNoteId(await actions.addNote(group.id))}
          >
            + Note
          </button>
        </div>
      )}
    </section>
  );
}

function SortableItem({
  item,
  groupId,
  tiles,
  children,
}: {
  item: ItemDTO;
  groupId: string;
  tiles: boolean;
  children: React.ReactNode;
}) {
  const s = useSortable({ id: itemKey(item.id), data: { type: "item", itemId: item.id, groupId } satisfies DragData });
  return (
    <div
      ref={s.setNodeRef}
      style={{ transform: CSS.Translate.toString(s.transform), transition: s.transition }}
      className={`group/drag relative ${tiles ? "" : "col-span-full"} ${s.isDragging ? "opacity-30" : ""}`}
    >
      <button
        type="button"
        aria-label="Drag to move"
        className={`absolute z-10 hidden cursor-grab touch-none rounded px-0.5 text-xs text-zinc-400 hover:text-zinc-700 group-hover/drag:block group-focus-within/drag:block [@media(hover:none)]:block dark:hover:text-zinc-200 ${
          tiles ? "left-1 top-1" : "-left-3 top-1/2 -translate-y-1/2"
        }`}
        {...s.attributes}
        {...s.listeners}
      >
        ⠿
      </button>
      {children}
    </div>
  );
}

function AddLinkForm({ onAdd, onCancel }: { onAdd: (url: string, title: string) => void; onCancel: () => void }) {
  return (
    <form
      className="mt-2 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        onAdd(String(form.get("url")), String(form.get("title")));
      }}
    >
      <input name="url" placeholder="Paste a link, e.g. example.com" className="field" autoFocus required />
      <input name="title" placeholder="Title (optional)" className="field" />
      <div className="flex gap-2">
        <button type="submit" className="btn-primary">Add link</button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function AddGroup({ onAdd }: { onAdd: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border-2 border-dashed border-zinc-300/80 p-4 text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-600 dark:hover:text-zinc-200"
      >
        + Add group
      </button>
    );
  }
  return (
    <form
      className="card space-y-2 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const name = String(new FormData(e.currentTarget).get("name")).trim();
        if (name) onAdd(name);
        setOpen(false);
      }}
    >
      <input name="name" placeholder="Group name" className="field" autoFocus required />
      <div className="flex gap-2">
        <button type="submit" className="btn-primary">Add group</button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

