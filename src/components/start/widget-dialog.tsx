"use client";

import { useEffect, useMemo, useState } from "react";
import { IconArrowLeft, IconX } from "@/components/icons";
import { WIDGET_INFO, WIDGET_TYPES, defaultConfig, type WidgetDTO, type WidgetType } from "@/lib/widgets";
import { api } from "./api";

type Props = {
  /** Editing an existing widget; otherwise adding a new one. */
  widget?: WidgetDTO;
  onClose: () => void;
  onSave: (type: WidgetType, config: Record<string, unknown>) => Promise<void>;
};

/** Pick a widget type, then set it up. Editing skips straight to the settings. */
export function WidgetDialog({ widget, onClose, onSave }: Props) {
  const [type, setType] = useState<WidgetType | null>(widget?.type ?? null);
  const [config, setConfig] = useState<Record<string, unknown>>(widget ? { ...(widget.config as Record<string, unknown>) } : {});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function choose(t: WidgetType) {
    setType(t);
    setConfig(defaultConfig(t));
    setError(null);
  }

  const set = (patch: Record<string, unknown>) => setConfig((c) => ({ ...c, ...patch }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!type) return;
    setBusy(true);
    setError(null);
    try {
      await onSave(type, config);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/30 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="widget-title"
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-xl flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl dark:bg-slate-900"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-900/[0.07] px-5 py-4 dark:border-white/10">
          <span className="flex items-center gap-2">
            {type && !widget && (
              <button type="button" className="icon-btn -ml-1 h-7 w-7" onClick={() => setType(null)} aria-label="Back to widget types">
                <IconArrowLeft size={16} />
              </button>
            )}
            <h2 id="widget-title" className="text-lg font-bold text-slate-900 dark:text-white">
              {widget ? `Edit ${WIDGET_INFO[widget.type].name.toLowerCase()}` : type ? WIDGET_INFO[type].name : "Add a widget"}
            </h2>
          </span>
          <button type="button" className="icon-btn -mr-1" onClick={onClose} aria-label="Close">
            <IconX size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {!type ? (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {WIDGET_TYPES.map((t) => (
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
          ) : (
            <div className="space-y-4">
              {type === "clock" && <ClockFields config={config} set={set} />}
              {type === "weather" && <WeatherFields config={config} set={set} />}
              {type === "countdown" && <CountdownFields config={config} set={set} />}
              {type === "rss" && <FeedFields config={config} set={set} />}
              {type !== "countdown" && (
                <Field label="Title" hint="Optional">
                  <input
                    className="field"
                    value={String(config.label ?? "")}
                    maxLength={60}
                    onChange={(e) => set({ label: e.target.value })}
                    placeholder={type === "todo" ? "To-do" : WIDGET_INFO[type].name}
                  />
                </Field>
              )}
            </div>
          )}
          {error && (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>

        {type && (
          <div className="flex justify-end gap-2 border-t border-slate-900/[0.07] px-5 py-4 dark:border-white/10">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? (type === "rss" ? "Checking the feed…" : "Saving…") : widget ? "Save" : "Add widget"}
            </button>
          </div>
        )}
      </form>
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
