"use client";

import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useState } from "react";
import { IconGrip, IconPencil, IconPlus, IconX } from "@/components/icons";
import {
  WIDGET_INFO,
  describeWeather,
  type FeedData,
  type WeatherData,
  type WidgetConfig,
  type WidgetDTO,
} from "@/lib/widgets";
import { api } from "./api";

export type WidgetActions = {
  update: (widgetId: string, config: Record<string, unknown>) => void;
  remove: (widgetId: string) => void;
  reorder: (ids: string[]) => void;
  edit: (widget: WidgetDTO) => void;
};

/** The row of widgets at the top of a page. Drag to reorder. */
export function WidgetsRow({ widgets, actions }: { widgets: WidgetDTO[]; actions: WidgetActions }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  if (widgets.length === 0) return null;

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = widgets.map((w) => w.id);
    actions.reorder(arrayMove(ids, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id))));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={widgets.map((w) => w.id)} strategy={rectSortingStrategy}>
        <div className="mb-4 grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] items-start gap-4">
          {widgets.map((w) => (
            <WidgetCard key={w.id} widget={w} actions={actions} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function WidgetCard({ widget, actions }: { widget: WidgetDTO; actions: WidgetActions }) {
  const sortable = useSortable({ id: widget.id });
  const style = { transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition };
  const title = (widget.config as { label?: string }).label || defaultTitle(widget);

  return (
    <section ref={sortable.setNodeRef} style={style} className={`card group/widget p-3.5 ${sortable.isDragging ? "opacity-40" : ""}`}>
      <header className="mb-2 flex items-center gap-1.5">
        <button
          type="button"
          className="-ml-1 cursor-grab touch-none rounded p-0.5 text-slate-300 hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-300"
          aria-label="Drag widget"
          {...sortable.attributes}
          {...sortable.listeners}
        >
          <IconGrip size={16} />
        </button>
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
        <span className="flex opacity-0 transition group-hover/widget:opacity-100 group-focus-within/widget:opacity-100">
          <button type="button" className="icon-btn h-7 w-7" onClick={() => actions.edit(widget)} aria-label={`Edit ${title}`} title="Edit">
            <IconPencil size={14} />
          </button>
          <button
            type="button"
            className="icon-btn h-7 w-7 hover:text-red-600"
            onClick={() => confirm(`Remove the "${title}" widget?`) && actions.remove(widget.id)}
            aria-label={`Remove ${title}`}
            title="Remove"
          >
            <IconX size={14} />
          </button>
        </span>
      </header>
      {widget.type === "clock" && <Clock config={widget.config as WidgetConfig<"clock">} />}
      {widget.type === "weather" && <Weather id={widget.id} config={widget.config as WidgetConfig<"weather">} />}
      {widget.type === "todo" && <Todo widget={widget} onChange={(config) => actions.update(widget.id, config)} />}
      {widget.type === "countdown" && <Countdown config={widget.config as WidgetConfig<"countdown">} />}
      {widget.type === "rss" && <Feed id={widget.id} config={widget.config as WidgetConfig<"rss">} />}
    </section>
  );
}

function defaultTitle(w: WidgetDTO) {
  if (w.type === "weather") return (w.config as WidgetConfig<"weather">).place.split(",")[0] || "Weather";
  if (w.type === "clock") {
    const tz = (w.config as WidgetConfig<"clock">).timeZone;
    return tz ? tz.split("/").pop()!.replace(/_/g, " ") : "Clock";
  }
  return WIDGET_INFO[w.type].name;
}

/** Re-renders every `ms` milliseconds. */
function useNow(ms: number) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function Clock({ config }: { config: WidgetConfig<"clock"> }) {
  const now = useNow(1000);
  const tz = config.timeZone || undefined;
  const time = now.toLocaleTimeString(undefined, { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: config.hour12 ?? undefined });
  const date = now.toLocaleDateString(undefined, { timeZone: tz, weekday: "long", month: "long", day: "numeric" });
  return (
    <div className="px-1 pb-1">
      <p className="text-4xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white">{time}</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{date}</p>
    </div>
  );
}

/** Loads a widget's live data, refreshing every `everyMs`. */
function useWidgetData<T>(id: string, everyMs: number, key: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      api<T>("GET", `/api/widgets/${id}/data`)
        .then((d) => alive && (setData(d), setError(null)))
        .catch((err) => alive && setError((err as Error).message));
    void load();
    const t = setInterval(load, everyMs);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [id, everyMs, key]);
  return { data, error };
}

function Weather({ id, config }: { id: string; config: WidgetConfig<"weather"> }) {
  const { data, error } = useWidgetData<WeatherData>(id, 15 * 60_000, `${config.latitude},${config.longitude},${config.units}`);
  if (error) return <p className="px-1 pb-1 text-sm text-slate-500 dark:text-slate-400">{error}</p>;
  if (!data) return <div className="h-24 animate-pulse rounded-lg bg-slate-900/[0.04] dark:bg-white/5" />;
  const now = describeWeather(data.current.code, data.current.isDay);
  const deg = "°";
  return (
    <div className="px-1 pb-1">
      <div className="flex items-center gap-3">
        <span className="text-4xl leading-none" aria-hidden="true">
          {now.emoji}
        </span>
        <div>
          <p className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
            {data.current.temperature}
            {deg}
            {data.units.toUpperCase()}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {now.text} · wind {data.current.wind} {data.units === "f" ? "mph" : "km/h"}
          </p>
        </div>
      </div>
      <ul className="mt-3 grid grid-cols-3 gap-1 text-center text-xs">
        {data.daily.slice(1, 4).map((d) => {
          const w = describeWeather(d.code);
          return (
            <li key={d.date} className="rounded-lg bg-slate-900/[0.03] py-1.5 dark:bg-white/5" title={w.text}>
              <span className="block text-slate-500 dark:text-slate-400">
                {new Date(`${d.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" })}
              </span>
              <span className="block text-base leading-tight" aria-hidden="true">
                {w.emoji}
              </span>
              <span className="tabular-nums text-slate-800 dark:text-slate-200">
                {d.high}
                {deg} <span className="text-slate-400">{d.low}{deg}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Todo({ widget, onChange }: { widget: WidgetDTO; onChange: (config: Record<string, unknown>) => void }) {
  const config = widget.config as WidgetConfig<"todo">;
  const items = config.items ?? [];
  const [text, setText] = useState("");
  const save = (next: typeof items) => onChange({ ...config, items: next });
  const left = items.filter((i) => !i.done).length;

  return (
    <div>
      {items.length > 0 && (
        <ul className="mb-2 space-y-0.5">
          {items.map((item) => (
            <li key={item.id} className="group/todo flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-slate-900/[0.03] dark:hover:bg-white/5">
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => save(items.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)))}
                className="h-4 w-4 shrink-0 accent-sync-600"
                aria-label={item.text}
              />
              <span className={`min-w-0 flex-1 break-words text-sm ${item.done ? "text-slate-400 line-through" : "text-slate-800 dark:text-slate-200"}`}>
                {item.text}
              </span>
              <button
                type="button"
                className="shrink-0 text-slate-300 opacity-0 hover:text-red-600 group-hover/todo:opacity-100 dark:text-slate-600"
                onClick={() => save(items.filter((i) => i.id !== item.id))}
                aria-label={`Delete ${item.text}`}
              >
                <IconX size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const value = text.trim();
          if (!value) return;
          save([...items, { id: crypto.randomUUID().slice(0, 12), text: value.slice(0, 200), done: false }]);
          setText("");
        }}
        className="flex items-center gap-1.5"
      >
        <IconPlus size={14} className="ml-1 shrink-0 text-slate-400" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={items.length >= 50 ? "List is full" : "Add a to-do"}
          disabled={items.length >= 50}
          className="min-w-0 flex-1 bg-transparent py-1 text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-200"
          aria-label="Add a to-do"
        />
      </form>
      {items.length > 0 && (
        <p className="mt-1.5 flex items-center justify-between px-1 text-xs text-slate-400">
          <span>{left === 0 ? "All done" : `${left} to go`}</span>
          {items.some((i) => i.done) && (
            <button type="button" className="hover:text-slate-700 dark:hover:text-slate-200" onClick={() => save(items.filter((i) => !i.done))}>
              Clear done
            </button>
          )}
        </p>
      )}
    </div>
  );
}

function Countdown({ config }: { config: WidgetConfig<"countdown"> }) {
  const now = useNow(60_000);
  const target = new Date(config.date.length <= 10 ? `${config.date}T00:00:00` : config.date);
  const ms = target.getTime() - now.getTime();
  const days = Math.floor(Math.abs(ms) / 86_400_000);
  const hours = Math.floor((Math.abs(ms) % 86_400_000) / 3_600_000);
  const sameDay = target.toDateString() === now.toDateString();
  return (
    <div className="px-1 pb-1">
      {sameDay ? (
        <p className="text-3xl font-bold text-sync-600 dark:text-sync-400">It&apos;s today!</p>
      ) : (
        <p className="text-4xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white">
          {days}
          <span className="ml-1.5 text-base font-semibold text-slate-500 dark:text-slate-400">
            {days === 1 ? "day" : "days"}
            {days < 3 && ms > 0 ? ` ${hours}h` : ""} {ms > 0 ? "to go" : "ago"}
          </span>
        </p>
      )}
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {target.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
      </p>
    </div>
  );
}

function ago(iso: string | null) {
  if (!iso) return "";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function Feed({ id, config }: { id: string; config: WidgetConfig<"rss"> }) {
  const { data, error } = useWidgetData<FeedData>(id, 30 * 60_000, `${config.feedUrl}:${config.limit}`);
  if (error) return <p className="px-1 pb-1 text-sm text-slate-500 dark:text-slate-400">{error}</p>;
  if (!data) return <div className="h-28 animate-pulse rounded-lg bg-slate-900/[0.04] dark:bg-white/5" />;
  if (data.items.length === 0) return <p className="px-1 pb-1 text-sm text-slate-500 dark:text-slate-400">No posts yet.</p>;
  return (
    <ul className="space-y-0.5">
      {data.items.map((item) => (
        <li key={item.url}>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-baseline gap-2 rounded-lg px-1 py-1 text-sm text-slate-800 hover:bg-slate-900/[0.03] dark:text-slate-200 dark:hover:bg-white/5"
          >
            <span className="line-clamp-2 min-w-0 flex-1">{item.title}</span>
            {item.publishedAt && <span className="shrink-0 text-xs text-slate-400">{ago(item.publishedAt)}</span>}
          </a>
        </li>
      ))}
    </ul>
  );
}
