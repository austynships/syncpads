"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IconArrowLeft, IconX } from "@/components/icons";
import { BUILT_IN_WIDGETS, WIDGET_INFO, defaultConfig, type WidgetConfig, type WidgetDTO, type WidgetType } from "@/lib/widgets";
import { api } from "./api";
import { CustomWidgetFrame } from "./custom-widget-frame";

type Props = {
  /** The page widgets are added to. */
  pageId: string;
  /** Editing an existing widget; otherwise adding a new one. */
  widget?: WidgetDTO;
  onClose: () => void;
  onSave: (type: WidgetType, config: Record<string, unknown>) => Promise<void>;
  /** After something changed outside onSave (a gallery widget was added). */
  onChanged: () => Promise<void> | void;
};

type Mode = WidgetType | "ai" | "gallery" | null;

/**
 * Add a widget: build one with AI, pick one from the gallery, or choose a
 * built-in type and set it up. Editing skips straight to the settings.
 */
export function WidgetDialog({ pageId, widget, onClose, onSave, onChanged }: Props) {
  const [mode, setMode] = useState<Mode>(widget ? (widget.type === "custom" ? "ai" : widget.type) : null);
  const [config, setConfig] = useState<Record<string, unknown>>(widget ? { ...(widget.config as Record<string, unknown>) } : {});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function choose(t: WidgetType) {
    setMode(t);
    setConfig(defaultConfig(t));
    setError(null);
  }

  const set = (patch: Record<string, unknown>) => setConfig((c) => ({ ...c, ...patch }));
  const builtIn = mode && mode !== "ai" && mode !== "gallery" && mode !== "custom" ? mode : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!builtIn) return;
    setBusy(true);
    setError(null);
    try {
      await onSave(builtIn, config);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const title = widget
    ? widget.type === "custom"
      ? "Edit custom widget"
      : `Edit ${WIDGET_INFO[widget.type].name.toLowerCase()}`
    : mode === "ai"
      ? "Create a widget with AI"
      : mode === "gallery"
        ? "Widget gallery"
        : builtIn
          ? WIDGET_INFO[builtIn].name
          : "Add a widget";

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/30 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="widget-title"
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl dark:bg-slate-900 ${
          mode === "gallery" || mode === "ai" ? "max-w-3xl" : "max-w-xl"
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-900/[0.07] px-5 py-4 dark:border-white/10">
          <span className="flex items-center gap-2">
            {mode && !widget && (
              <button type="button" className="icon-btn -ml-1 h-7 w-7" onClick={() => setMode(null)} aria-label="Back">
                <IconArrowLeft size={16} />
              </button>
            )}
            <h2 id="widget-title" className="text-lg font-bold text-slate-900 dark:text-white">
              {title}
            </h2>
          </span>
          <button type="button" className="icon-btn -mr-1" onClick={onClose} aria-label="Close">
            <IconX size={18} />
          </button>
        </div>

        {mode === "ai" ? (
          <AiBuilder widget={widget} onSave={async (cfg) => (await onSave("custom", cfg), onClose())} onClose={onClose} />
        ) : mode === "gallery" ? (
          <Gallery pageId={pageId} onAdded={async () => (await onChanged(), onClose())} />
        ) : (
          <>
            <div className="overflow-y-auto px-5 py-4">
              {!mode ? (
                <>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setMode("ai")}
                      className="flex items-start gap-3 rounded-xl border border-sync-500/40 bg-sync-500/[0.05] p-3.5 text-left transition hover:border-sync-500 hover:bg-sync-500/[0.09]"
                    >
                      <span className="text-2xl leading-none" aria-hidden="true">✨</span>
                      <span>
                        <span className="block font-semibold text-slate-900 dark:text-white">Create with AI</span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                          Describe any widget, such as a timer, tracker or calculator, and AI builds it.
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("gallery")}
                      className="flex items-start gap-3 rounded-xl border border-slate-900/10 p-3.5 text-left transition hover:border-sync-500 hover:bg-sync-500/[0.04] dark:border-white/10 dark:hover:border-sync-500"
                    >
                      <span className="text-2xl leading-none" aria-hidden="true">🧩</span>
                      <span>
                        <span className="block font-semibold text-slate-900 dark:text-white">Widget gallery</span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                          Widgets other people built and shared. Free for everyone.
                        </span>
                      </span>
                    </button>
                  </div>
                  <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-slate-500">Built in</p>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {BUILT_IN_WIDGETS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => choose(t)}
                        className="flex items-start gap-3 rounded-xl border border-slate-900/10 p-3.5 text-left transition hover:border-sync-500 hover:bg-sync-500/[0.04] dark:border-white/10 dark:hover:border-sync-500"
                      >
                        <span className="text-2xl leading-none" aria-hidden="true">
                          {WIDGET_INFO[t].emoji}
                        </span>
                        <span>
                          <span className="block font-semibold text-slate-900 dark:text-white">{WIDGET_INFO[t].name}</span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-slate-600 dark:text-slate-400">{WIDGET_INFO[t].description}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              ) : builtIn ? (
                <div className="space-y-4">
                  {builtIn === "clock" && <ClockFields config={config} set={set} />}
                  {builtIn === "weather" && <WeatherFields config={config} set={set} />}
                  {builtIn === "countdown" && <CountdownFields config={config} set={set} />}
                  {builtIn === "rss" && <FeedFields config={config} set={set} />}
                  {builtIn !== "countdown" && (
                    <Field label="Title" hint="Optional">
                      <input
                        className="field"
                        value={String(config.label ?? "")}
                        maxLength={60}
                        onChange={(e) => set({ label: e.target.value })}
                        placeholder={builtIn === "todo" ? "To-do" : WIDGET_INFO[builtIn].name}
                      />
                    </Field>
                  )}
                </div>
              ) : null}
              {error && (
                <p className="mt-3 text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}
            </div>

            {builtIn && (
              <div className="flex justify-end gap-2 border-t border-slate-900/[0.07] px-5 py-4 dark:border-white/10">
                <button type="button" className="btn-ghost" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={busy}>
                  {busy ? (builtIn === "rss" ? "Checking the feed…" : "Saving…") : widget ? "Save" : "Add widget"}
                </button>
              </div>
            )}
          </>
        )}
      </form>
    </div>
  );
}

// ---------- Create with AI ----------

const IDEAS = [
  "A Pomodoro timer with 25/5 minute sessions and a session count",
  "A habit tracker for 3 habits with a weekly grid",
  "A tip calculator that splits the bill",
  "A currency converter between USD, EUR and GBP",
  "A daily water tracker with 8 glasses",
  "A random inspirational quote with a refresh button",
];

type Built = { name: string; description: string; html: string };

/** Describe, build, preview, ask for changes, save. Also publishes to the gallery. */
function AiBuilder({ widget, onSave, onClose }: { widget?: WidgetDTO; onSave: (config: Record<string, unknown>) => Promise<void>; onClose: () => void }) {
  const existing = widget?.type === "custom" ? (widget.config as WidgetConfig<"custom">) : null;
  const [prompt, setPrompt] = useState(existing?.prompt ?? "");
  const [built, setBuilt] = useState<Built | null>(existing ? { name: existing.label || existing.name, description: "", html: existing.html } : null);
  const [change, setChange] = useState("");
  const [building, setBuilding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ text: string; upgrade: boolean } | null>(null);
  const [publish, setPublish] = useState<{ open: boolean; description: string; state: "idle" | "sending" | "sent"; error?: string }>({
    open: false,
    description: "",
    state: "idle",
  });

  async function build(withChange: boolean) {
    setBuilding(true);
    setError(null);
    try {
      const res = await api<{ widget: Built }>("POST", "/api/widgets/generate", {
        prompt: prompt || built?.name || "A widget",
        ...(withChange && built ? { currentHtml: built.html, change } : {}),
      });
      setBuilt({ ...res.widget, name: withChange && built ? built.name : res.widget.name });
      if (withChange) setChange("");
      setPublish((p) => ({ ...p, description: p.description || res.widget.description }));
    } catch (err) {
      setError({ text: (err as Error).message, upgrade: (err as { upgrade?: boolean }).upgrade === true });
    } finally {
      setBuilding(false);
    }
  }

  async function save() {
    if (!built) return;
    setSaving(true);
    setError(null);
    try {
      const unchanged = existing && built.html === existing.html;
      await onSave({
        name: built.name.trim() || "My widget",
        html: built.html,
        prompt: prompt || existing?.prompt,
        ...(existing?.data !== undefined ? { data: existing.data } : {}),
        // A gallery copy stays marked as one until its code is changed.
        ...(unchanged && existing?.sourceGalleryId ? { sourceGalleryId: existing.sourceGalleryId } : {}),
      });
    } catch (err) {
      setError({ text: (err as Error).message, upgrade: false });
      setSaving(false);
    }
  }

  async function sendToGallery() {
    if (!widget || !built) return;
    setPublish((p) => ({ ...p, state: "sending", error: undefined }));
    try {
      await api("POST", `/api/widgets/${widget.id}/publish`, { name: built.name, description: publish.description });
      setPublish((p) => ({ ...p, state: "sent" }));
    } catch (err) {
      setPublish((p) => ({ ...p, state: "idle", error: (err as Error).message }));
    }
  }

  const canPublish = Boolean(widget && existing && !existing.sourceGalleryId && built && built.html === existing.html);

  return (
    <>
      <div className="grid flex-1 gap-5 overflow-y-auto px-5 py-4 md:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {!built ? (
            <>
              <Field label="Describe your widget">
                <textarea
                  className="field min-h-28"
                  value={prompt}
                  maxLength={2000}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="A Pomodoro timer with 25 minute focus sessions, a short break, and a count of today's sessions"
                  autoFocus
                />
              </Field>
              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">Ideas</p>
                <div className="flex flex-wrap gap-1.5">
                  {IDEAS.map((idea) => (
                    <button
                      key={idea}
                      type="button"
                      onClick={() => setPrompt(idea)}
                      className="rounded-full border border-slate-900/10 px-2.5 py-1 text-xs text-slate-600 hover:border-sync-500 hover:text-slate-900 dark:border-white/10 dark:text-slate-300 dark:hover:text-white"
                    >
                      {idea.replace(/^A |^An /, "").split(" with")[0].split(" that")[0].split(" for")[0]}
                    </button>
                  ))}
                </div>
              </div>
              <button type="button" className="btn-primary w-full py-2.5" disabled={building || prompt.trim().length < 3} onClick={() => build(false)}>
                {building ? "Building your widget… (about 30 seconds)" : "✨ Build widget"}
              </button>
            </>
          ) : (
            <>
              <Field label="Name">
                <input className="field" value={built.name} maxLength={60} onChange={(e) => setBuilt({ ...built, name: e.target.value })} />
              </Field>
              <Field label="Want something different?" hint="Optional">
                <span className="flex gap-2">
                  <input
                    className="field"
                    value={change}
                    maxLength={2000}
                    onChange={(e) => setChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (change.trim()) void build(true);
                      }
                    }}
                    placeholder="Make the buttons bigger, add a sound when the timer ends…"
                  />
                  <button type="button" className="btn-secondary shrink-0" disabled={building || !change.trim()} onClick={() => build(true)}>
                    {building ? "Updating…" : "Update"}
                  </button>
                </span>
              </Field>
              {!existing && (
                <button
                  type="button"
                  className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  onClick={() => setBuilt(null)}
                >
                  Start over
                </button>
              )}

              {widget && existing && (
                <div className="rounded-xl border border-slate-900/10 p-3.5 dark:border-white/10">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Share in the gallery</p>
                  {existing.sourceGalleryId ? (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">This widget came from the gallery, so it can&apos;t be published again.</p>
                  ) : publish.state === "sent" ? (
                    <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">Sent for review. You&apos;ll get a notification when it&apos;s in the gallery.</p>
                  ) : !canPublish ? (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Save your changes first, then publish.</p>
                  ) : publish.open ? (
                    <>
                      <input
                        className="field mt-2"
                        value={publish.description}
                        maxLength={200}
                        onChange={(e) => setPublish((p) => ({ ...p, description: e.target.value }))}
                        placeholder="One sentence: what it does"
                      />
                      <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                        It&apos;s reviewed before it&apos;s listed. People who add it get their own copy, with your first name as the author. Its saved data
                        isn&apos;t shared.
                      </p>
                      {publish.error && <p className="mt-1 text-xs text-red-600">{publish.error}</p>}
                      <button type="button" className="btn-primary mt-2" disabled={publish.state === "sending" || publish.description.trim().length < 5} onClick={sendToGallery}>
                        {publish.state === "sending" ? "Sending…" : "Send for review"}
                      </button>
                    </>
                  ) : (
                    <button type="button" className="btn-secondary mt-2" onClick={() => setPublish((p) => ({ ...p, open: true }))}>
                      Publish to gallery
                    </button>
                  )}
                </div>
              )}
            </>
          )}
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error.text}{" "}
              {error.upgrade && (
                <a href="/pricing" className="font-semibold underline">
                  See Pro
                </a>
              )}
            </p>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Preview</p>
          <div className="card min-h-40 p-3.5">
            {built ? (
              <>
                <p className="mb-2 truncate px-1 text-sm font-semibold text-slate-900 dark:text-white">{built.name || "My widget"}</p>
                <CustomWidgetFrame key={built.html} html={built.html} data={existing?.data} title={built.name} maxHeight={440} />
              </>
            ) : (
              <p className="flex h-32 items-center justify-center text-center text-sm text-slate-400">
                {building ? "Building…" : "Your widget shows up here."}
              </p>
            )}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">Widgets run in a sandbox: they can&apos;t see your account or the rest of SyncPads.</p>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-900/[0.07] px-5 py-4 dark:border-white/10">
        <button type="button" className="btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn-primary" disabled={!built || saving || building} onClick={save}>
          {saving ? "Saving…" : widget ? "Save" : "Add widget"}
        </button>
      </div>
    </>
  );
}

// ---------- Gallery ----------

type GalleryItem = { id: string; name: string; description: string; html: string; author: string; installs: number };

function Gallery({ pageId, onAdded }: { pageId: string; onAdded: () => Promise<void> }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<GalleryItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reported, setReported] = useState<Set<string>>(new Set());

  const load = useCallback(async (query: string) => {
    try {
      setItems((await api<{ widgets: GalleryItem[] }>("GET", `/api/gallery${query ? `?q=${encodeURIComponent(query)}` : ""}`)).widgets);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(q.trim()), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [q, load]);

  async function add(item: GalleryItem) {
    setBusy(item.id);
    setMessage(null);
    try {
      await api("POST", `/api/gallery/${item.id}/install`, { pageId });
      await onAdded();
    } catch (err) {
      setMessage((err as Error).message);
      setBusy(null);
    }
  }

  async function report(item: GalleryItem) {
    const reason = window.prompt(`What's wrong with "${item.name}"? It'll be reviewed.`);
    if (reason === null) return;
    try {
      await api("POST", `/api/gallery/${item.id}/report`, { reason });
      setReported((s) => new Set(s).add(item.id));
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4">
      <input className="field mb-4" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the gallery" aria-label="Search the gallery" />
      {message && <p className="mb-3 text-sm text-red-600">{message}</p>}
      {items === null ? (
        <p className="py-10 text-center text-sm text-slate-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
          {q ? "No widgets match that." : "No widgets in the gallery yet. Build one with AI and publish it to be the first."}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <div key={item.id} className="flex flex-col rounded-2xl border border-slate-900/10 p-3 dark:border-white/10">
              <div className="card mb-3 max-h-56 overflow-hidden p-3">
                <CustomWidgetFrame html={item.html} title={item.name} maxHeight={200} />
              </div>
              <p className="font-semibold text-slate-900 dark:text-white">{item.name}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{item.description}</p>
              <p className="mt-1 text-[11px] text-slate-400">
                By {item.author} · {item.installs.toLocaleString()} {item.installs === 1 ? "add" : "adds"}
              </p>
              <div className="mt-auto flex items-center justify-between pt-3">
                <button type="button" className="btn-primary" disabled={busy !== null} onClick={() => add(item)}>
                  {busy === item.id ? "Adding…" : "Add to page"}
                </button>
                {reported.has(item.id) ? (
                  <span className="text-xs text-slate-400">Reported</span>
                ) : (
                  <button type="button" className="text-xs text-slate-400 hover:text-red-600" onClick={() => report(item)}>
                    Report
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-slate-900 dark:text-white">
      {label} {hint && <span className="font-normal text-slate-500 dark:text-slate-400">({hint})</span>}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

type FieldsProps = { config: Record<string, unknown>; set: (patch: Record<string, unknown>) => void };

function ClockFields({ config, set }: FieldsProps) {
  const zones = useMemo(() => {
    try {
      return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone");
    } catch {
      return [];
    }
  }, []);
  return (
    <>
      <Field label="Time zone">
        <select className="field" value={String(config.timeZone ?? "")} onChange={(e) => set({ timeZone: e.target.value || undefined })}>
          <option value="">My time zone</option>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </Field>
      <label className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
        <input type="checkbox" className="h-4 w-4 accent-sync-600" checked={config.hour12 === false} onChange={(e) => set({ hour12: e.target.checked ? false : undefined })} />
        Use 24-hour time
      </label>
    </>
  );
}

function WeatherFields({ config, set }: FieldsProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ place: string; latitude: number; longitude: number }[] | null>(null);
  const [searching, setSearching] = useState(false);

  async function search() {
    if (query.trim().length < 2) return;
    setSearching(true);
    try {
      setResults((await api<{ places: { place: string; latitude: number; longitude: number }[] }>("GET", `/api/widgets/geocode?q=${encodeURIComponent(query)}`)).places);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  return (
    <>
      <Field label="Place">
        {config.place ? (
          <span className="flex items-center justify-between gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700">
            <span className="truncate text-slate-900 dark:text-white">{String(config.place)}</span>
            <button type="button" className="shrink-0 text-xs font-semibold text-sync-600" onClick={() => set({ place: "" })}>
              Change
            </button>
          </span>
        ) : (
          <>
            <span className="flex gap-2">
              <input
                className="field"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void search();
                  }
                }}
                placeholder="City, such as Detroit"
                autoFocus
              />
              <button type="button" className="btn-secondary shrink-0" onClick={search} disabled={searching}>
                {searching ? "Searching…" : "Search"}
              </button>
            </span>
            {results && (
              <span className="mt-2 block overflow-hidden rounded-lg border border-slate-900/10 dark:border-white/10">
                {results.length === 0 ? (
                  <span className="block px-3 py-2 text-sm text-slate-500">No places found.</span>
                ) : (
                  results.map((r) => (
                    <button
                      key={`${r.latitude},${r.longitude}`}
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-900/[0.04] dark:text-slate-200 dark:hover:bg-white/5"
                      onClick={() => {
                        set({ place: r.place, latitude: r.latitude, longitude: r.longitude });
                        setResults(null);
                      }}
                    >
                      {r.place}
                    </button>
                  ))
                )}
              </span>
            )}
          </>
        )}
      </Field>
      <Field label="Units">
        <span className="flex gap-2">
          {(["f", "c"] as const).map((u) => (
            <button
              key={u}
              type="button"
              aria-pressed={config.units === u}
              onClick={() => set({ units: u })}
              className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${
                config.units === u ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900" : "border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300"
              }`}
            >
              {u === "f" ? "°F" : "°C"}
            </button>
          ))}
        </span>
      </Field>
    </>
  );
}

function CountdownFields({ config, set }: FieldsProps) {
  return (
    <>
      <Field label="Counting down to">
        <input className="field" value={String(config.label ?? "")} maxLength={60} onChange={(e) => set({ label: e.target.value })} placeholder="Product launch" autoFocus />
      </Field>
      <Field label="Date">
        <input className="field" type="date" value={String(config.date ?? "").slice(0, 10)} onChange={(e) => set({ date: e.target.value })} />
      </Field>
    </>
  );
}

function FeedFields({ config, set }: FieldsProps) {
  return (
    <>
      <Field label="Feed or website address">
        <input
          className="field"
          value={String(config.feedUrl ?? "")}
          onChange={(e) => set({ feedUrl: e.target.value })}
          placeholder="https://www.theverge.com"
          autoFocus
        />
        <span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">
          Paste a site&apos;s address and SyncPads finds its feed, or paste the RSS or Atom feed itself.
        </span>
      </Field>
      <Field label="Posts to show">
        <select className="field w-28" value={Number(config.limit ?? 6)} onChange={(e) => set({ limit: Number(e.target.value) })}>
          {[3, 5, 6, 8, 10, 15].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}
