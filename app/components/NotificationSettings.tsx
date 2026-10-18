"use client";

import { useEffect, useState } from "react";

type Preferences = {
  emailEnabled: boolean;
  browserEnabled: boolean;
  digest: "daily" | "weekly" | "never";
  events: Record<string, boolean>;
};

const labels: Record<string, string> = {
  customerCreated: "New customers",
  overdueInvoice: "Overdue invoices",
  taskAssigned: "Assigned tasks",
  paymentFailed: "Failed payments",
  aiRecommendation: "AI recommendations",
  integrationEvent: "Payments and integrations",
  leadUpdate: "Lead-service updates",
};

export default function NotificationSettings() {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/notifications", { cache: "no-store" }).then((response) => response.json()).then((result) => setPreferences(result.data?.preferences ?? null)).catch(() => undefined);
  }, []);

  async function save(next: Preferences) {
    setPreferences(next); setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save notification preferences.");
      setNotice("Notification preferences saved.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not save notification preferences."); }
    finally { setBusy(false); }
  }

  if (!preferences) return null;
  return <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="text-xs uppercase tracking-[0.18em] text-violet-300">Notifications</p><h2 className="mt-2 text-xl font-semibold">Choose how Kora keeps you informed</h2><p className="mt-1 text-sm leading-6 text-slate-400">Notifications describe recorded workspace activity. Kora will not contact customers or take external action without your approval.</p></div>{notice && <p role="status" className="text-sm text-emerald-200">{notice}</p>}</div>
    <div className="mt-5 grid gap-4 md:grid-cols-3">
      <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-4 text-sm"><input type="checkbox" checked={preferences.emailEnabled} disabled={busy} onChange={(event) => void save({ ...preferences, emailEnabled: event.target.checked })} className="accent-violet-400" /> Email alerts</label>
      <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-4 text-sm"><input type="checkbox" checked={preferences.browserEnabled} disabled={busy} onChange={(event) => void save({ ...preferences, browserEnabled: event.target.checked })} className="accent-violet-400" /> Browser alerts</label>
      <label className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm">Digest frequency<select value={preferences.digest} disabled={busy} onChange={(event) => void save({ ...preferences, digest: event.target.value as Preferences["digest"] })} className="mt-2 w-full rounded-lg border border-white/10 bg-[#0b0b14] px-3 py-2 text-sm"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="never">Never</option></select></label>
    </div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(labels).map(([key, label]) => <label key={key} className="flex items-center gap-3 rounded-lg border border-white/5 px-3 py-2 text-sm text-slate-300"><input type="checkbox" checked={preferences.events[key] ?? true} disabled={busy} onChange={(event) => void save({ ...preferences, events: { ...preferences.events, [key]: event.target.checked } })} className="accent-violet-400" /> {label}</label>)}</div>
  </section>;
}
