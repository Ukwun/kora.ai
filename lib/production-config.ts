import { getDatabasePoolConfig, isProductionRuntime } from "./database-config";

export function getProductionConfigurationIssues() {
  if (!isProductionRuntime()) return [];

  const issues: string[] = [];
  const required = [
    "DATABASE_URL",
    "SESSION_SECRET",
    "APP_URL",
    "EMAIL_FROM",
    "RESEND_API_KEY",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "FIREBASE_PROJECT_ID",
  ];

  for (const key of required) {
    if (!process.env[key]?.trim()) issues.push(key);
  }

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON && (!process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY)) {
    issues.push("FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY (or FIREBASE_SERVICE_ACCOUNT_JSON)");
  }
  if ((process.env.SESSION_SECRET?.length ?? 0) < 32) issues.push("SESSION_SECRET (at least 32 characters)");

  try {
    const appUrl = new URL(process.env.APP_URL ?? "");
    if (appUrl.protocol !== "https:") issues.push("APP_URL (must use HTTPS)");
  } catch {
    issues.push("APP_URL (must be a valid absolute URL)");
  }

  const sender = process.env.EMAIL_FROM ?? "";
  const senderAddress = /<([^<>]+)>/.exec(sender)?.[1] ?? sender;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderAddress)) issues.push("EMAIL_FROM (must contain a valid sender address)");

  if (process.env.DATABASE_SSL === "false") issues.push("DATABASE_SSL (must verify database certificates in production)");
  if (process.env.DATABASE_URL) {
    try {
      getDatabasePoolConfig(process.env.DATABASE_URL);
    } catch (error) {
      issues.push(error instanceof Error ? error.message : "DATABASE_POOL_MAX/TLS configuration");
    }
  }

  const optionalPairs = [
    ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    ["FACEBOOK_APP_ID", "FACEBOOK_APP_SECRET"],
    ["PAYSTACK_PUBLIC_KEY", "PAYSTACK_SECRET_KEY"],
  ] as const;
  for (const [publicKey, privateKey] of optionalPairs) {
    if (Boolean(process.env[publicKey]) !== Boolean(process.env[privateKey])) {
      issues.push(`${publicKey} and ${privateKey} must be configured together`);
    }
  }

  return [...new Set(issues)];
}

export function assertProductionConfiguration() {
  const issues = getProductionConfigurationIssues();
  if (issues.length) {
    throw new Error(`Production configuration is incomplete: ${issues.join(", ")}`);
  }
}
