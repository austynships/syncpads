/**
 * Processes one enrichment job (SP-13):
 *   1. Links: fetch the page safely and extract a clean title and text snapshot.
 *      Notes: take the note's own text.
 *   2. If the user turned smart features on: a two-sentence summary and tags
 *      (Claude), and an embedding for search by meaning (Voyage).
 *   3. Save, and give untitled links their page title.
 * Network and AI calls are injected so tests can run without them.
 */
import { eq, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { itemEnrichment, items, userSettings } from "@/db/schema";
import { upsertEmbedding } from "@/db/vector";
import { BlockedUrlError, safeFetch } from "@/server/safe-fetch";
import { aiAvailability, embed, embeddingText, EMBEDDING_MODEL, RetryableError, summarizePage, type Summary } from "./ai";
import { extractFromHtml, noteText } from "./extract";
import { retryLater, type Job } from "./queue";

export type Deps = {
  fetchPage: (url: string) => Promise<{ status: number; contentType: string; body: Buffer; finalUrl: string }>;
  summarize: typeof summarizePage;
  embed: typeof embed;
  availability: () => { summaries: boolean; embeddings: boolean };
};

export const defaultDeps: Deps = {
  // PRD "Abuse": max 5 MB per fetched page.
  fetchPage: (url) => safeFetch(url, { maxBytes: 5 * 1024 * 1024, timeoutMs: 15_000, maxRedirects: 5 }),
  summarize: summarizePage,
  embed,
  availability: aiAvailability,
};

/** A failure that retrying won't fix (blocked address, 404, not a web page). */
class PermanentError extends Error {}

export async function processJob(db: Db, job: Job, deps: Deps = defaultDeps): Promise<"done" | "retry" | "failed" | "skipped"> {
  const [item] = await db.select().from(items).where(eq(items.id, job.itemId));
  const [row] = await db.select().from(itemEnrichment).where(eq(itemEnrichment.itemId, job.itemId));
  if (!item || !row) return "skipped"; // deleted meanwhile (rows cascade)

  try {
    // ---------- 1. text ----------
    let title = row.title;
    let text = row.textSnapshot ?? "";
    let description: string | null = null;
    const needsFetch = row.fetchedAt === null;

    if (needsFetch) {
      if (item.type === "note") {
        title = null;
        text = noteText(item.noteBody ?? "");
      } else {
        const page = await fetchLink(item.url ?? "", deps);
        title = page.title;
        text = page.text;
        description = page.description;
      }
      await db
        .update(itemEnrichment)
        .set({ fetchedAt: new Date(), title, textSnapshot: text || null })
        .where(eq(itemEnrichment.itemId, job.itemId));

      // Untitled links get the page's own title (the user can still rename them).
      if (item.type === "link" && !item.title && title) {
        await db.update(items).set({ title }).where(eq(items.id, item.id));
        await bumpRevision(db, item.userId);
      }
    }

    // ---------- 2. AI (only with the user's consent and a configured provider) ----------
    const [settings] = await db
      .select({ aiEnabled: userSettings.aiEnabled })
      .from(userSettings)
      .where(eq(userSettings.userId, item.userId));
    const available = deps.availability();
    // A refetch (new URL or note text) starts the AI part over.
    let summary: Summary | null = !needsFetch && row.summary ? { summary: row.summary, tags: row.tags ?? [] } : null;
    let summarizedAt = needsFetch ? null : row.summarizedAt;
    let embeddedAt = needsFetch ? null : row.embeddedAt;

    if (settings?.aiEnabled) {
      if (item.type === "link" && available.summaries && !summarizedAt && text.length >= 200) {
        summary = await deps.summarize({ url: item.url ?? "", title: title ?? item.title, description, text });
        summarizedAt = new Date();
      }
      const searchable = embeddingText({
        title: item.title || title,
        url: item.url,
        summary: summary?.summary ?? null,
        tags: summary?.tags ?? [],
        text,
      });
      if (available.embeddings && !embeddedAt && searchable.trim()) {
        const [vector] = await deps.embed([searchable], "document");
        await upsertEmbedding(db, { itemId: item.id, userId: item.userId, model: EMBEDDING_MODEL, embedding: vector });
        embeddedAt = new Date();
      }
    }

    // ---------- 3. save ----------
    const summaryChanged = (summary?.summary ?? null) !== row.summary;
    await db
      .update(itemEnrichment)
      .set({
        status: "done",
        summary: summary?.summary ?? null,
        tags: summary?.tags ?? null,
        summarizedAt,
        embeddedAt,
        error: null,
        claimToken: null,
        nextAttemptAt: null,
      })
      .where(eq(itemEnrichment.itemId, job.itemId));
    if (summaryChanged) await bumpRevision(db, item.userId); // so open start pages show the summary
    return "done";
  } catch (err) {
    const message = (err as Error).message || "Unknown error";
    if (err instanceof PermanentError || err instanceof BlockedUrlError) {
      await db
        .update(itemEnrichment)
        .set({ status: "failed", error: message.slice(0, 255), claimToken: null })
        .where(eq(itemEnrichment.itemId, job.itemId));
      return "failed";
    }
    if (!(err instanceof RetryableError)) console.error(`[enrich] ${job.itemId}:`, err);
    await retryLater(db, job, message);
    return "retry";
  }
}

async function fetchLink(url: string, deps: Deps) {
  if (!url) throw new PermanentError("No URL");
  let res: Awaited<ReturnType<Deps["fetchPage"]>>;
  try {
    res = await deps.fetchPage(url);
  } catch (err) {
    if (err instanceof BlockedUrlError) throw err;
    throw new RetryableError(`Fetch: ${(err as Error).message}`); // DNS hiccup, reset, timeout
  }
  if (res.status === 429 || res.status >= 500) throw new RetryableError(`Fetch: HTTP ${res.status}`);
  if (res.status >= 400) throw new PermanentError(`Fetch: HTTP ${res.status}`);
  if (!/html|xml/.test(res.contentType)) {
    return { title: null, description: null, text: "" }; // a PDF, image or file: keep the link, no text
  }
  return extractFromHtml(res.body.toString("utf8"));
}

async function bumpRevision(db: Db, userId: string) {
  await db.execute(sql`UPDATE user_settings SET revision = revision + 1 WHERE user_id = ${userId}`);
}
