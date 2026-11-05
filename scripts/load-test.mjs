const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
function positiveInteger(value, fallback, name) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer.`);
  return parsed;
}

const concurrency = positiveInteger(process.env.CONCURRENCY, 10, "CONCURRENCY");
const requestsPerWorker = positiveInteger(process.env.REQUESTS_PER_WORKER, 10, "REQUESTS_PER_WORKER");
const paths = (process.env.LOAD_PATHS ?? "/api/health").split(",").map((path) => path.trim()).filter(Boolean);
const email = process.env.LOAD_TEST_EMAIL;
const password = process.env.LOAD_TEST_PASSWORD;
const timeoutMs = positiveInteger(process.env.LOAD_REQUEST_TIMEOUT_MS, 15_000, "LOAD_REQUEST_TIMEOUT_MS");
const started = Date.now();
let failures = 0;
let cookie = "";
const latencies = [];
const statusCounts = {};

if (Boolean(email) !== Boolean(password)) {
  throw new Error("Set both LOAD_TEST_EMAIL and LOAD_TEST_PASSWORD to run authenticated load tests.");
}
if (paths.length === 0) throw new Error("Set LOAD_PATHS to at least one API GET path.");

if (email && password) {
  const response = await fetch(`${baseUrl}/api/auth/signin`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
    redirect: "manual",
  });
  if (!response.ok) throw new Error(`Load-test sign-in failed with HTTP ${response.status}.`);
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) throw new Error("Load-test sign-in did not issue a session cookie.");
  cookie = setCookie.split(";")[0];
}

await Promise.all(Array.from({ length: concurrency }, async () => {
  for (let index = 0; index < requestsPerWorker; index += 1) {
    try {
      const path = paths[index % paths.length];
      const requestStarted = Date.now();
      const response = await fetch(new URL(path, baseUrl), {
        headers: cookie ? { cookie } : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
      latencies.push(Date.now() - requestStarted);
      statusCounts[response.status] = (statusCounts[response.status] ?? 0) + 1;
      await response.body?.cancel();
      if (!response.ok) failures += 1;
    } catch {
      failures += 1;
    }
  }
}));

const total = concurrency * requestsPerWorker;
latencies.sort((left, right) => left - right);
const percentile = (fraction) => latencies.length
  ? latencies[Math.min(Math.ceil(latencies.length * fraction) - 1, latencies.length - 1)]
  : null;
console.log(JSON.stringify({
  baseUrl,
  paths,
  authenticated: Boolean(cookie),
  concurrency,
  total,
  failures,
  durationMs: Date.now() - started,
  requestsPerSecond: Math.round(total / Math.max((Date.now() - started) / 1000, 0.001)),
  statusCounts,
  latencyMs: { p50: percentile(0.5), p95: percentile(0.95), max: latencies.at(-1) ?? null },
  timeoutMs,
}, null, 2));
if (failures > 0) process.exitCode = 1;
