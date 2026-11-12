/**
 * Runs Drizzle migrations from ./drizzle when the production server starts.
 * Called from src/instrumentation.ts. Safe to run repeatedly: applied
 * migrations are tracked in the __drizzle_migrations table.
 */
import path from "node:path";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { db } from "./index";

export async function runMigrations() {
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  console.log(`[db] Running migrations from ${migrationsFolder}`);
  await migrate(db, { migrationsFolder });
  console.log("[db] Migrations complete");
}

