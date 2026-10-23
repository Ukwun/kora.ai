import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run migrations");
}

const pool = new pg.Pool({ connectionString, ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false } });
const migrationDirectory = new URL("../migrations/", import.meta.url);
const migrations = (await readdir(migrationDirectory)).filter((file) => file.endsWith(".sql")).sort();
await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`);
for (const migration of migrations) {
  const sql = await readFile(new URL(migration, migrationDirectory), "utf8");
  const checksum = createHash("sha256").update(sql).digest("hex");
  const existing = await pool.query("SELECT checksum FROM schema_migrations WHERE version = $1", [migration]);
  if (existing.rows[0]) {
    if (existing.rows[0].checksum !== checksum) throw new Error(`Migration ${migration} was modified after it was applied`);
    console.log(`Skipped ${migration}`);
    continue;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)", [migration, checksum]);
    await client.query("COMMIT");
    console.log(`Applied ${migration}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
await pool.end();
console.log("Database migration complete");
