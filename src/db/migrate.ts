/**
 * Database migration script.
 *
 * Reads and executes src/db/schema.sql against the database at DATABASE_URL.
 * All statements use IF NOT EXISTS, so this is safe to run repeatedly.
 *
 * Usage:
 *   bun run src/db/migrate.ts
 *
 * Requires DATABASE_URL to be set in the environment.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

async function migrate() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ DATABASE_URL is not set. Connect a database before migrating.");
    process.exit(1);
  }

  const schemaPath = resolve(import.meta.dirname, "schema.sql");
  let sql: string;

  try {
    sql = readFileSync(schemaPath, "utf-8");
  } catch (err) {
    console.error(`❌ Failed to read schema file at ${schemaPath}:`, err);
    process.exit(1);
  }

  if (!sql.trim()) {
    console.error("❌ Schema file is empty.");
    process.exit(1);
  }

  console.log("📦 Running migration...");

  // Split the schema into individual statements (neon doesn't support multi-statement queries)
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  try {
    const db = neon(url);
    for (const stmt of statements) {
      await db.query(stmt);
    }
    console.log(`✅ Migration complete — ${statements.length} statements executed successfully.`);
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
}

migrate();
