import { Pool, type QueryResultRow } from "pg";

const connectionString = process.env.DATABASE_URL;

export const postgresEnabled = Boolean(connectionString);

const pool = connectionString
  ? new Pool({
      connectionString,
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
    })
  : null;

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []) {
  if (!pool) {
    throw new Error("DATABASE_URL is not configured");
  }

  return pool.query<T>(text, values);
}

export async function closeDatabase() {
  await pool?.end();
}
