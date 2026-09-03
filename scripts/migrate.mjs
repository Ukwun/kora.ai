import { readFile } from "node:fs/promises";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run migrations");
}

const sql = await readFile(new URL("../migrations/001_initial.sql", import.meta.url), "utf8");
const pool = new pg.Pool({ connectionString, ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false } });
await pool.query(sql);
await pool.end();
console.log("Database migration complete");
