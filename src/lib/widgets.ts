/**
 * Widgets: small live cards at the top of a page (clock, weather, to-do list,
 * countdown, news feed). Shared by the server (validation) and the browser
 * (the Add widget dialog and the widgets themselves).
 */
import { z } from "zod";

export const WIDGET_TYPES = ["clock", "weather", "todo", "countdown", "rss"] as const;
export type WidgetType = (typeof WIDGET_TYPES)[number];

/** Most widgets one page can have. */
export const MAX_WIDGETS_PER_PAGE = 12;
export const MAX_TODOS = 50;

const label = z.string().trim().max(60).optional();

export const widgetConfigSchemas = {
  clock: z.object({
    label,
    /** IANA time zone, such as "America/Detroit"; empty means the viewer's own. */
    timeZone: z
      .string()
      .max(64)
      .optional()
      .refine((tz) => !tz || isTimeZone(tz), "Pick a valid time zone."),
    hour12: z.boolean().optional(),
  }),
  weather: z.object({
    label,
    place: z.string().trim().min(1, "Choose a place.").max(120),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    units: z.enum(["c", "f"]).default("f"),
  }),
  todo: z.object({
    label,
    items: z
      .array(z.object({ id: z.string().max(40), text: z.string().trim().max(200), done: z.boolean() }))
      .max(MAX_TODOS, `A list can have up to ${MAX_TODOS} items.`)
      .default([]),
  }),
  countdown: z.object({
    label: z.string().trim().min(1, "Name what you're counting down to.").max(60),
    /** ISO date or date-time. */
    date: z.string().refine((d) => !Number.isNaN(Date.parse(d)), "Pick a date."),
  }),
  rss: z.object({
    label,
    feedUrl: z
      .string()
      .trim()
      .max(2048)
      .refine((u) => /^https?:\/\//i.test(u), "Enter the feed's full address, starting with https://"),
    limit: z.number().int().min(3).max(15).default(6),
  }),
} as const;

export type WidgetConfig<T extends WidgetType = WidgetType> = z.infer<(typeof widgetConfigSchemas)[T]>;
export type AnyWidgetConfig = { [T in WidgetType]: WidgetConfig<T> }[WidgetType];

export function parseWidgetConfig(type: WidgetType, config: unknown): AnyWidgetConfig {
  const result = widgetConfigSchemas[type].safeParse(config);
  if (!result.success) throw new Error(result.error.issues[0]?.message ?? "Those widget settings aren't valid.");
  return result.data as AnyWidgetConfig;
}

export function isTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** For the Add widget dialog. */
export const WIDGET_INFO: Record<WidgetType, { name: string; emoji: string; description: string }> = {
  clock: { name: "Clock", emoji: "🕒", description: "The time and date, in your time zone or anywhere else." },
  weather: { name: "Weather", emoji: "⛅", description: "Today's weather and the next few days for any place." },
  todo: { name: "To-do list", emoji: "✅", description: "A quick checklist for the things on this page." },
  countdown: { name: "Countdown", emoji: "⏳", description: "Days left until a launch, deadline or trip." },
  rss: { name: "News feed", emoji: "📰", description: "The latest posts from a blog or news site (RSS or Atom)." },
};

/** What each widget type starts with, before the person changes it. */
export function defaultConfig(type: WidgetType): Record<string, unknown> {
  switch (type) {
    case "clock":
      return {};
    case "todo":
      return { items: [] };
    case "countdown":
      return { label: "", date: "" };
    case "weather":
      return { place: "", latitude: 0, longitude: 0, units: "f" };
    case "rss":
      return { feedUrl: "", limit: 6 };
  }
}

export type WidgetDTO = { id: string; type: WidgetType; config: AnyWidgetConfig; position: number };

export type WeatherData = {
  place: string;
  units: "c" | "f";
  current: { temperature: number; code: number; isDay: boolean; wind: number };
  daily: { date: string; high: number; low: number; code: number }[];
};

export type FeedData = { title: string | null; items: { title: string; url: string; publishedAt: string | null }[] };

/** WMO weather codes (used by Open-Meteo) to a short description and an emoji. */
export function describeWeather(code: number, isDay = true): { text: string; emoji: string } {
  if (code === 0) return { text: "Clear", emoji: isDay ? "☀️" : "🌙" };
  if (code <= 2) return { text: "Partly cloudy", emoji: isDay ? "⛅" : "☁️" };
  if (code === 3) return { text: "Cloudy", emoji: "☁️" };
  if (code === 45 || code === 48) return { text: "Fog", emoji: "🌫️" };
  if (code >= 51 && code <= 57) return { text: "Drizzle", emoji: "🌦️" };
  if (code >= 61 && code <= 67) return { text: "Rain", emoji: "🌧️" };
  if (code >= 71 && code <= 77) return { text: "Snow", emoji: "🌨️" };
  if (code >= 80 && code <= 82) return { text: "Showers", emoji: "🌦️" };
  if (code === 85 || code === 86) return { text: "Snow showers", emoji: "🌨️" };
  if (code >= 95) return { text: "Thunderstorm", emoji: "⛈️" };
  return { text: "—", emoji: "🌡️" };
}
