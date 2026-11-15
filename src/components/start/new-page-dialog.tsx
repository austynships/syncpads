"use client";

import { useEffect, useState } from "react";
import { IconX } from "@/components/icons";
import { PAGE_TEMPLATES } from "@/lib/page-templates";

type Choice = { id: string; name: string; emoji: string; description: string; summary: string; groups: string[] };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const CHOICES: Choice[] = [
  { id: "blank", name: "Blank", emoji: "📄", description: "Start from scratch with one empty group.", summary: "Empty", groups: [] },
  ...PAGE_TEMPLATES.map((t) => {
    const links = t.page.groups.reduce((n, g) => n + g.items.filter((i) => i.type === "link").length, 0);
    const notes = t.page.groups.reduce((n, g) => n + g.items.filter((i) => i.type === "note").length, 0);
    return {
      id: t.id,
      name: t.name,
      emoji: t.emoji,
      description: t.description,
      summary: [plural(links, "link", "links"), ...(notes ? [plural(notes, "note", "notes")] : [])].join(" · "),
      groups: t.page.groups.map((g) => g.name),
    };
  }),
];

/**
 * Adding a page: pick a template (or Blank) and a name. Templates fill the page
 * with groups, links and starter notes that can be changed like anything else.
 */
export function NewPageDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, template: string) => Promise<void> }) {
  const [selected, setSelected] = useState("blank");
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function pick(choice: Choice) {
    setSelected(choice.id);
    // Suggest the template's name until the person types their own.
    if (!nameTouched) setName(choice.id === "blank" ? "" : choice.name);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const finalName = name.trim() || (selected === "blank" ? "New page" : (CHOICES.find((c) => c.id === selected)?.name ?? "New page"));
    setBusy(true);
    try {
      await onCreate(finalName, selected);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/30 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-page-title"
        onSubmit={create}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-900/[0.07] px-5 py-4 dark:border-white/10">
          <div>
            <h2 id="new-page-title" className="text-lg font-bold text-slate-900 dark:text-white">
              New page
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Start blank or from a template. You can change everything afterwards.
            </p>
          </div>
          <button type="button" className="icon-btn -mr-1" onClick={onClose} aria-label="Close">
            <IconX size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Template">
            {CHOICES.map((c) => {
              const active = selected === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => pick(c)}
                  onDoubleClick={() => {
                    pick(c);
                    setTimeout(() => (document.getElementById("new-page-create") as HTMLButtonElement | null)?.click(), 0);
                  }}
                  className={`flex flex-col rounded-xl border p-3.5 text-left transition ${
                    active
                      ? "border-sync-500 bg-sync-500/[0.06] ring-2 ring-sync-500/25"
                      : "border-slate-900/10 hover:border-slate-900/25 hover:bg-slate-900/[0.02] dark:border-white/10 dark:hover:border-white/25 dark:hover:bg-white/[0.03]"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-xl leading-none" aria-hidden="true">
                      {c.emoji}
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">{c.name}</span>
                  </span>
                  <span className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{c.description}</span>
                  {c.groups.length > 0 && (
                    <span className="mt-2 flex flex-wrap gap-1">
                      {c.groups.map((g) => (
                        <span key={g} className="rounded-md bg-slate-900/[0.05] px-1.5 py-0.5 text-[11px] text-slate-600 dark:bg-white/10 dark:text-slate-300">
                          {g}
                        </span>
                      ))}
                    </span>
                  )}
                  <span className="mt-auto pt-2 text-[11px] font-medium text-slate-400 dark:text-slate-500">{c.summary}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-900/[0.07] px-5 py-4 sm:flex-row sm:items-center dark:border-white/10">
          <label className="flex-1">
            <span className="sr-only">Page name</span>
            <input
              className="field"
              value={name}
              maxLength={255}
              onChange={(e) => {
                setName(e.target.value);
                setNameTouched(true);
              }}
              placeholder="Page name"
              autoFocus
            />
          </label>
          <span className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button id="new-page-create" type="submit" className="btn-primary" disabled={busy}>
              {busy ? "Creating…" : "Create page"}
            </button>
          </span>
        </div>
      </form>
    </div>
  );
}
