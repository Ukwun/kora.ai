import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

const localStore = new Map<string, { count: number; resetTime: number }>();
const distributedLimiters = new Map<string, Ratelimit>();

export function checkRateLimit(identifier: string, limit = 100, windowSeconds = 60) {
  const now = Date.now();
  const current = localStore.get(identifier);
  if (!current || now > current.resetTime) {
    localStore.set(identifier, { count: 1, resetTime: now + windowSeconds * 1000 });
    return true;
  }
  if (current.count >= limit) return false;
  current.count++;
  return true;
}

export async function checkDistributedRateLimit(identifier: string, limit = 100, windowSeconds = 60) {
  const hasRedisUrl = Boolean(process.env.UPSTASH_REDIS_REST_URL);
  const hasRedisToken = Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);
  if (!hasRedisUrl || !hasRedisToken) {
    if (process.env.NODE_ENV === "production" || process.env.NETLIFY === "true") {
      throw new Error("Distributed rate limiting is not configured in production.");
    }
    return checkRateLimit(identifier, limit, windowSeconds);
  }

  const key = `${limit}:${windowSeconds}`;
  let limiter = distributedLimiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
      prefix: "kora",
    });
    distributedLimiters.set(key, limiter);
  }
  return (await limiter.limit(identifier)).success;
}

export function getClientIP(request: Pick<Request, "headers">) {
  return request.headers.get("x-nf-client-connection-ip")
    || request.headers.get("x-real-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

export async function checkRequestRateLimit(
  request: Pick<Request, "headers">,
  scope: string,
  limit: number,
  windowSeconds: number,
) {
  return checkDistributedRateLimit(`${scope}:${getClientIP(request)}`, limit, windowSeconds);
}

export async function checkRateLimitBackend() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return false;
  try {
    const response = await fetch(`${url.replace(/\/+$/, "")}/ping`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) return false;
    const result = await response.json() as { result?: unknown };
    return result.result === "PONG";
  } catch {
    return false;
  }
}
