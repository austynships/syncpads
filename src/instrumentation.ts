// Runs once when the Next.js server starts.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.RUN_MIGRATIONS_ON_START !== "true") return;

  const { runMigrations } = await import("./db/migrate");
  await runMigrations();
}

