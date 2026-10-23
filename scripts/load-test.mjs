const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
const concurrency = Math.max(1, Number(process.env.CONCURRENCY ?? 10));
const requestsPerWorker = Math.max(1, Number(process.env.REQUESTS_PER_WORKER ?? 10));
const started = Date.now();
let failures = 0;

await Promise.all(Array.from({ length: concurrency }, async () => {
  for (let index = 0; index < requestsPerWorker; index += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (!response.ok) failures += 1;
    } catch {
      failures += 1;
    }
  }
}));

const total = concurrency * requestsPerWorker;
console.log(JSON.stringify({ baseUrl, total, failures, durationMs: Date.now() - started, requestsPerSecond: Math.round(total / Math.max((Date.now() - started) / 1000, 0.001)) }, null, 2));
if (failures > 0) process.exitCode = 1;
