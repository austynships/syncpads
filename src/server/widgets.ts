/**
 * Widgets on a page: create, change, remove and reorder them (owners and
 * editors of a shared page alike), and the live data some of them show:
 * weather from Open-Meteo (free, no key) and RSS/Atom feeds.
 */
import { and, asc, desc, eq, inArray, max, sql } from "drizzle-orm";
import { db } from "@/db";
import { feedItems, widgets } from "@/db/schema";
import { decodeEntities } from "@/lib/bookmarks";
import { redis } from "@/lib/redis";
import { normalizeUrl } from "@/lib/url";
import {
  MAX_WIDGETS_PER_PAGE,
  parseWidgetConfig,
  type AnyWidgetConfig,
  type FeedData,
  type WeatherData,
  type WidgetConfig,
  type WidgetType,
} from "@/lib/widgets";
import { notifyPageActivity } from "./notifications";
import { safeFetch } from "./safe-fetch";
import { InvalidInputError, NotFoundError, pageAccess, write } from "./start-page";

const WEATHER_TTL = 15 * 60; // seconds
const FEED_TTL = 30 * 60;

function validConfig(type: WidgetType, config: unknown): AnyWidgetConfig {
  try {
    return parseWidgetConfig(type, config);
  } catch (err) {
    throw new InvalidInputError((err as Error).message);
  }
}

async function widgetPage(widgetId: string) {
  const [w] = await db.select({ pageId: widgets.pageId, type: widgets.type, config: widgets.config }).from(widgets).where(eq(widgets.id, widgetId));
  if (!w) throw new NotFoundError("Widget");
  return w;
}

// ---------- changes ----------

export async function createWidget(actorId: string, input: { pageId: string; type: WidgetType; config: unknown }) {
  const config = validConfig(input.type, input.config);
  // A feed is checked before it's added, so a wrong address fails right away.
  if (input.type === "rss") (config as WidgetConfig<"rss">).feedUrl = (await findFeed((config as WidgetConfig<"rss">).feedUrl)).url;
  return write(actorId, async (tx, touch) => {
    const { ownerId } = await pageAccess(tx, actorId, input.pageId);
    const [{ n, top }] = await tx
      .select({ n: sql<number>`COUNT(*)`, top: max(widgets.position) })
      .from(widgets)
      .where(eq(widgets.pageId, input.pageId));
    if (Number(n) >= MAX_WIDGETS_PER_PAGE) throw new InvalidInputError(`A page can have up to ${MAX_WIDGETS_PER_PAGE} widgets.`);
    const id = crypto.randomUUID();
    await tx.insert(widgets).values({ id, userId: ownerId, pageId: input.pageId, type: input.type, config, position: (top ?? -1) + 1 });
    await touch(input.pageId);
    // Everyone else on a shared page hears about it (combined with links and notes added in a burst).
    await notifyPageActivity(tx, actorId, input.pageId, { widgets: 1 });
    return { widget: { id, type: input.type, config, position: (top ?? -1) + 1 } };
  });
}

export async function updateWidget(actorId: string, widgetId: string, input: { config: unknown }) {
  const current = await widgetPage(widgetId);
  const config = validConfig(current.type, input.config);
  const feedChanged = current.type === "rss" && (current.config as { feedUrl?: string } | null)?.feedUrl !== (config as WidgetConfig<"rss">).feedUrl;
  if (feedChanged) (config as WidgetConfig<"rss">).feedUrl = (await findFeed((config as WidgetConfig<"rss">).feedUrl)).url;
  return write(actorId, async (tx, touch) => {
    await pageAccess(tx, actorId, current.pageId, "Widget");
    await tx.update(widgets).set({ config }).where(eq(widgets.id, widgetId));
    if (feedChanged) {
      await tx.delete(feedItems).where(eq(feedItems.widgetId, widgetId));
      await redis.del(`feed:fetched:${widgetId}`).catch(() => 0);
    }
    await touch(current.pageId);
    return { widget: { id: widgetId, type: current.type, config } };
  });
}

export async function deleteWidget(actorId: string, widgetId: string) {
  const current = await widgetPage(widgetId);
  return write(actorId, async (tx, touch) => {
    await pageAccess(tx, actorId, current.pageId, "Widget");
    await tx.delete(widgets).where(eq(widgets.id, widgetId));
    await touch(current.pageId);
    return {};
  });
}

export async function reorderWidgets(actorId: string, pageId: string, ids: string[]) {
  return write(actorId, async (tx, touch) => {
    await pageAccess(tx, actorId, pageId);
    const rows = ids.length ? await tx.select({ id: widgets.id }).from(widgets).where(and(eq(widgets.pageId, pageId), inArray(widgets.id, ids))) : [];
    if (rows.length !== new Set(ids).size) throw new NotFoundError("Widget");
    for (const [position, id] of ids.entries()) await tx.update(widgets).set({ position }).where(eq(widgets.id, id));
    await touch(pageId);
    return {};
  });
}

// ---------- live data ----------

/** What a weather or feed widget shows. Anyone who can see the page can load it. */
export async function widgetData(actorId: string, widgetId: string): Promise<WeatherData | FeedData> {
  const w = await widgetPage(widgetId);
  await pageAccess(db, actorId, w.pageId, "Widget");
  return loadWidgetData(widgetId, w);
}

/** Loads the data; the caller has already checked the viewer may see the widget. */
export async function loadWidgetData(widgetId: string, w?: Awaited<ReturnType<typeof widgetPage>>): Promise<WeatherData | FeedData> {
  w ??= await widgetPage(widgetId);
  if (w.type === "weather") return weather(parseWidgetConfig("weather", w.config) as WidgetConfig<"weather">);
  if (w.type === "rss") return feed(widgetId, parseWidgetConfig("rss", w.config) as WidgetConfig<"rss">);
  throw new InvalidInputError("This widget doesn't load data.");
}

async function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const hit = await redis.get(key).catch(() => null);
  if (hit) return JSON.parse(hit) as T;
  const value = await load();
  await redis.set(key, JSON.stringify(value), "EX", ttl).catch(() => null);
  return value;
}

async function fetchJson(url: string) {
  const res = await safeFetch(url, { maxBytes: 256 * 1024, timeoutMs: 6000 });
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  return JSON.parse(res.body.toString("utf8"));
}

async function weather(config: WidgetConfig<"weather">): Promise<WeatherData> {
  const lat = config.latitude.toFixed(2);
  const lon = config.longitude.toFixed(2);
  const data = await cached(`weather:${lat}:${lon}:${config.units}`, WEATHER_TTL, async () => {
    const unit = config.units === "f" ? "&temperature_unit=fahrenheit&wind_speed_unit=mph" : "";
    try {
      return await fetchJson(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=4&timezone=auto${unit}`,
      );
    } catch {
      throw new InvalidInputError("Weather isn't available right now. Try again in a few minutes.");
    }
  });
  return {
    place: config.place,
    units: config.units,
    current: {
      temperature: Math.round(data.current.temperature_2m),
      code: data.current.weather_code,
      isDay: data.current.is_day === 1,
      wind: Math.round(data.current.wind_speed_10m),
    },
    daily: (data.daily.time as string[]).map((date, i) => ({
      date,
      high: Math.round(data.daily.temperature_2m_max[i]),
      low: Math.round(data.daily.temperature_2m_min[i]),
      code: data.daily.weather_code[i],
    })),
  };
}

/** Places for the weather widget's search box. */
export async function geocode(query: string) {
  const q = query.trim().slice(0, 100);
  if (q.length < 2) return [];
  return cached(`geocode:${q.toLowerCase()}`, 7 * 86_400, async () => {
    try {
      const data = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?count=6&language=en&format=json&name=${encodeURIComponent(q)}`);
      return ((data.results ?? []) as { name: string; admin1?: string; country?: string; latitude: number; longitude: number }[]).map((r) => ({
        place: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
        latitude: r.latitude,
        longitude: r.longitude,
      }));
    } catch {
      throw new InvalidInputError("Place search isn't available right now. Try again in a moment.");
    }
  });
}

// ---------- feeds ----------

const text = (s: string | undefined) =>
  decodeEntities((s ?? "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, "i"))?.[1];

/** Parses RSS 2.0, RSS 1.0 and Atom. Links that aren't http(s) are dropped. */
export function parseFeed(xml: string): FeedData {
  const isAtom = /<feed\b/i.test(xml) && !/<rss\b/i.test(xml);
  const blocks = xml.match(isAtom ? /<entry\b[\s\S]*?<\/entry>/gi : /<item\b[\s\S]*?<\/item>/gi) ?? [];
  const head = xml.slice(0, xml.search(isAtom ? /<entry\b/i : /<item\b/i) >>> 0 || 4000);
  const items: FeedData["items"] = [];
  for (const block of blocks.slice(0, 50)) {
    let link = "";
    if (isAtom) {
      const links = [...block.matchAll(/<link\b([^>]*)\/?>/gi)].map((m) => m[1]);
      const pick = links.find((a) => /rel=["']alternate["']/i.test(a)) ?? links.find((a) => !/rel=/i.test(a)) ?? links[0] ?? "";
      link = decodeEntities(pick.match(/href=["']([^"']+)["']/i)?.[1] ?? "");
    } else {
      link = text(tag(block, "link")) || text(tag(block, "guid"));
    }
    const url = normalizeUrl(link);
    const title = text(tag(block, "title")) || url;
    if (!url || !title) continue;
    const date = text(tag(block, "pubDate") ?? tag(block, "published") ?? tag(block, "updated") ?? tag(block, "dc:date"));
    const parsed = date ? new Date(date) : null;
    items.push({ title: title.slice(0, 500), url, publishedAt: parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : null });
  }
  return { title: text(tag(head, "title")) || null, items };
}

/**
 * Finds the feed at an address. If it's a normal web page, looks for the feed
 * it advertises (<link rel="alternate" type="application/rss+xml">).
 */
export async function findFeed(address: string): Promise<{ url: string; data: FeedData }> {
  const url = normalizeUrl(address);
  if (!url) throw new InvalidInputError("Enter the feed's full address, starting with https://");
  const load = async (target: string) => {
    try {
      const res = await safeFetch(target, { maxBytes: 2 * 1024 * 1024, timeoutMs: 8000 });
      return res.status === 200 ? { body: res.body.toString("utf8"), finalUrl: res.finalUrl } : null;
    } catch {
      return null;
    }
  };
  const first = await load(url);
  if (!first) throw new InvalidInputError("Couldn't reach that address. Check it and try again.");
  if (/<(rss|feed|rdf:RDF)\b/i.test(first.body.slice(0, 5000))) {
    const data = parseFeed(first.body);
    if (data.items.length) return { url: first.finalUrl, data };
  }
  const advertised = [...first.body.matchAll(/<link\b[^>]*>/gi)]
    .map((m) => m[0])
    .find((t) => /rel=["']?alternate/i.test(t) && /type=["']?application\/(rss|atom)\+xml/i.test(t));
  const href = advertised?.match(/href=["']([^"']+)["']/i)?.[1];
  if (href) {
    const feedUrl = new URL(decodeEntities(href), first.finalUrl).toString();
    const second = await load(feedUrl);
    if (second) {
      const data = parseFeed(second.body);
      if (data.items.length) return { url: second.finalUrl, data };
    }
  }
  throw new InvalidInputError("No news feed found there. Try the site's RSS or Atom feed address.");
}

/** A feed widget's latest posts: refreshed at most every 30 minutes, kept in feed_items. */
async function feed(widgetId: string, config: WidgetConfig<"rss">): Promise<FeedData> {
  const fresh = await redis.get(`feed:fetched:${widgetId}`).catch(() => null);
  if (!fresh) {
    try {
      const { data } = await findFeed(config.feedUrl);
      const [owner] = await db.select({ userId: widgets.userId }).from(widgets).where(eq(widgets.id, widgetId));
      if (owner) {
        await db.transaction(async (tx) => {
          await tx.delete(feedItems).where(eq(feedItems.widgetId, widgetId));
          if (data.items.length) {
            await tx.insert(feedItems).values(
              data.items.slice(0, 50).map((i) => ({
                userId: owner.userId,
                widgetId,
                title: i.title.slice(0, 512),
                url: i.url.slice(0, 2048),
                publishedAt: i.publishedAt ? new Date(i.publishedAt) : null,
              })),
            );
          }
        });
        await redis.set(`feed:title:${widgetId}`, data.title ?? "", "EX", 7 * 86_400).catch(() => null);
      }
    } catch {
      // Keep showing what we have; try again on the next refresh.
    }
    await redis.set(`feed:fetched:${widgetId}`, "1", "EX", FEED_TTL).catch(() => null);
  }
  const rows = await db
    .select({ title: feedItems.title, url: feedItems.url, publishedAt: feedItems.publishedAt })
    .from(feedItems)
    .where(eq(feedItems.widgetId, widgetId))
    .orderBy(sql`${feedItems.publishedAt} IS NULL`, desc(feedItems.publishedAt), asc(feedItems.createdAt))
    .limit(config.limit);
  const title = await redis.get(`feed:title:${widgetId}`).catch(() => null);
  return { title: title || null, items: rows.map((r) => ({ title: r.title, url: r.url, publishedAt: r.publishedAt?.toISOString() ?? null })) };
}
