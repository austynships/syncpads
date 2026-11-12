/**
 * SyncPads enrichment worker (SP-13). Runs as its own container next to the
 * app (docker-compose.prod.yml "worker"), so fetching pages and calling AI
 * providers never slows down saves or page loads.
 *
 * Bundled to dist/worker.mjs by `npm run build:worker`. Locally: `npm run worker`.
 */
import { db, pool } from "@/db";
import { aiAvailability, EMBEDDING_MODEL, SUMMARY_MODEL } from "@/server/enrichment/ai";
import { processJob } from "@/server/enrichment/process";
import { claim, enqueueMissing, releaseStale } from "@/server/enrichment/queue";

const CONCURRENCY = Number(process.env.ENRICH_CONCURRENCY ?? 4);
const IDLE_MS = 2000;

let stopping = false;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForDatabase() {
  // The app runs migrations on start; wait until the queue table has its new columns.
  for (;;) {
    try {
      await pool.query("SELECT claim_token FROM item_enrichment LIMIT 1");
      return;
    } catch (err) {
      console.log(`[worker] waiting for database: ${(err as Error).message}`);
      await sleep(5000);
    }
  }
}

async function main() {
  const ai = aiAvailability();
  console.log(
    `[worker] starting: concurrency ${CONCURRENCY}; summaries ${ai.summaries ? `on (${SUMMARY_MODEL})` : "off (no ANTHROPIC_API_KEY)"}; ` +
      `search by meaning ${ai.embeddings ? `on (${EMBEDDING_MODEL})` : "off (no VOYAGE_API_KEY)"}`,
  );
  await waitForDatabase();

  let lastHousekeeping = 0;
  while (!stopping) {
    if (Date.now() - lastHousekeeping > 60_000) {
      await releaseStale(db);
      await enqueueMissing(db); // links saved before this worker existed
      lastHousekeeping = Date.now();
    }

    const jobs = await claim(db, CONCURRENCY);
    if (jobs.length === 0) {
      await sleep(IDLE_MS);
      continue;
    }
    const results = await Promise.all(jobs.map((job) => processJob(db, job)));
    const counts = results.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r]: (acc[r] ?? 0) + 1 }), {});
    console.log(`[worker] processed ${jobs.length}: ${JSON.stringify(counts)}`);
  }
  await pool.end();
  console.log("[worker] stopped");
}

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    console.log(`[worker] ${signal}: finishing current jobs`);
    stopping = true;
  });
}

main().catch((err) => {
  console.error("[worker] crashed:", err);
  process.exit(1);
});
