import { Pool, type QueryResultRow } from "pg";
import { getDatabasePoolConfig } from "./database-config";

const connectionString = process.env.DATABASE_URL;

export const postgresEnabled = Boolean(connectionString);

const pool = connectionString
  ? new Pool(getDatabasePoolConfig(connectionString))
  : null;

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []) {
  if (!pool) {
    throw new Error("DATABASE_URL is not configured");
  }

  return pool.query<T>(text, values);
}

export async function withTransaction<T>(callback: (client: { query: typeof query }) => Promise<T>) {
  if (!pool) {
    throw new Error("DATABASE_URL is not configured");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabase() {
  await pool?.end();
}
