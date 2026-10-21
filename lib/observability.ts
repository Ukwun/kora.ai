type SentryDsn = { publicKey: string; host: string; projectId: string };

function parseDsn(value: string | undefined): SentryDsn | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const projectId = url.pathname.replace(/^\//, "").split("/").filter(Boolean).at(-1);
    if (!projectId || !url.username) return null;
    return { publicKey: url.username, host: url.host, projectId };
  } catch { return null; }
}

export async function reportServerError(input: { error: unknown; path: string; method: string; routePath?: string }) {
  const dsn = parseDsn(process.env.SENTRY_DSN);
  if (!dsn) return;
  const error = input.error instanceof Error ? input.error : new Error(String(input.error));
  const event = {
    event_id: crypto.randomUUID().replaceAll("-", ""),
    timestamp: Date.now() / 1000,
    platform: "javascript",
    level: "error",
    message: error.message,
    exception: { values: [{ type: error.name, value: error.message, stacktrace: error.stack ? { frames: [{ filename: input.path, function: input.method, module: input.routePath }] } : undefined }] },
    request: { url: input.path, method: input.method },
    tags: { route: input.routePath ?? "unknown", app: "kora" },
  };
  const envelope = `${JSON.stringify({ event_id: event.event_id, sent_at: new Date().toISOString(), sdk: { name: "kora-observability", version: "1.0" } })}\n${JSON.stringify({ type: "event" })}\n${JSON.stringify(event)}`;
  try { await fetch(`https://${dsn.host}/api/${dsn.projectId}/envelope/?sentry_version=7&sentry_key=${encodeURIComponent(dsn.publicKey)}&sentry_client=kora-observability/1.0`, { method: "POST", headers: { "Content-Type": "application/x-sentry-envelope" }, body: envelope }); } catch { /* Monitoring must never affect a user request. */ }
}
