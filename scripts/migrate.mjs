import { readdir, readFile } from "node:fs/promises";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run migrations");
}

const pool = new pg.Pool({ connectionString, ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false } });
const migrationDirectory = new URL("../migrations/", import.meta.url);
const migrations = (await readdir(migrationDirectory)).filter((file) => file.endsWith(".sql")).sort();
for (const migration of migrations) {
  await pool.query(await readFile(new URL(migration, migrationDirectory), "utf8"));
  console.log(`Applied ${migration}`);
}
await pool.end();
console.log("Database migration complete");
