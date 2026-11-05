import type { PoolConfig } from "pg";

export function isProductionRuntime() {
  return process.env.NODE_ENV === "production" || process.env.NETLIFY === "true";
}

function normalizedConnectionString(connectionString: string) {
  const url = new URL(connectionString);
  for (const key of ["sslmode", "sslrootcert", "sslcert", "sslkey", "sslpassword"]) {
    url.searchParams.delete(key);
  }
  return url.toString();
}

function databaseSsl() {
  const allowInsecureLocalConnection = process.env.DATABASE_SSL === "false";
  if (allowInsecureLocalConnection && isProductionRuntime()) {
    throw new Error("DATABASE_SSL=false is not allowed in production.");
  }
  if (allowInsecureLocalConnection) return false;

  const ca = process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n");
  return ca ? { rejectUnauthorized: true, ca } : { rejectUnauthorized: true };
}

function positiveInteger(value: string | undefined, fallback: number, name: string) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

export function getDatabasePoolConfig(connectionString: string): PoolConfig {
  const production = isProductionRuntime();
  const max = positiveInteger(process.env.DATABASE_POOL_MAX, production ? 1 : 10, "DATABASE_POOL_MAX");
  if (production && max > 5) {
    throw new Error("DATABASE_POOL_MAX must be 5 or less in production; use a serverless database pooler for higher concurrency.");
  }

  return {
    connectionString: normalizedConnectionString(connectionString),
    ssl: databaseSsl(),
    max,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 20_000,
    allowExitOnIdle: true,
  };
}
