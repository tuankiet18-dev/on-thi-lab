/**
 * Database migration runner.
 *
 * Run this before starting the API server to apply any pending Drizzle
 * migrations. Intended as a pre-start step in CI/CD or Docker entrypoints.
 *
 * Usage (from repo root):
 *   pnpm --filter @onthilab/database migrate
 *   # or with env file:
 *   node --env-file=../../.env.local -e "require('./dist/migrate.js')"
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[migrate] DATABASE_URL is required.");
  process.exit(1);
}

// Migrations folder is at the root of this package: packages/database/drizzle/
const migrationsFolder = resolve(__dirname, "../drizzle");

console.log("[migrate] Connecting to database...");
const client = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(client);

try {
  console.log(`[migrate] Applying migrations from: ${migrationsFolder}`);
  await migrate(db, { migrationsFolder });
  console.log("[migrate] ✅ All migrations applied successfully.");
} catch (error) {
  console.error("[migrate] ❌ Migration failed:", error);
  process.exit(1);
} finally {
  await client.end();
}
