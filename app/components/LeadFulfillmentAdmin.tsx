"use client";

import { useEffect, useState } from "react";

type QueueRecord = { id: string; entityType: string; title: string; summary: string; status: string; data: Record<string, unknown>; createdAt: string };

export default function LeadFulfillmentAdmin() {
  const [records, setRecords] = useState<QueueRecord[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [notice, setNotice] = useState("");

  async function load() {
    const response = await fetch("/api/lead-service/fulfillment", { cache: "no-store" });
    if (response.status === 403) { setForbidden(true); return; }
    const result = await response.json();
    if (response.ok) setRecords(result.data ?? []);
  }
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, []);

  async function update(id: string, deliveryStatus: "sent" | "rejected" | "replaced") {
    const response = await fetch("/api/lead-service/fulfillment", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, deliveryStatus }) });
    const result = await response.json();
    setNotice(response.ok ? "Lead fulfillment status updated." : result.error ?? "Could not update lead status.");
    if (response.ok) await load();
  }

  if (forbidden || !records.length) return null;
  const subscriptions = records.filter((record) => record.entityType === "lead_subscription" && record.status === "active");
  const leads = records.filter((record) => record.entityType === "lead_delivery");
  return <section className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.04] p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.18em] text-amber-200">Admin fulfillment</p><h2 className="mt-2 text-xl font-semibold">Lead delivery queue</h2><p className="mt-1 text-sm leading-6 text-slate-400">Every lead shows its source, consent evidence, opt-out method, quality score, and replacement eligibility before delivery.</p></div>{notice && <p role="status" className="text-sm text-emerald-200">{notice}</p>}</div><div className="mt-5 space-y-3">{leads.map((lead) => <article key={lead.id} className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="flex flex-col justify-between gap-3 md:flex-row md:items-start"><div><p className="font-medium">{lead.title}</p><p className="mt-1 text-sm text-slate-400">{lead.summary}</p><p className="mt-2 text-xs text-slate-500">Source: {String(lead.data.source)} · Consent: {String(lead.data.consentStatus)} · Quality: {String(lead.data.qualityScore)}/5 · Opt out: {String(lead.data.optOutMethod)}</p></div><div className="flex flex-wrap gap-2"><span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-slate-300">{lead.status}</span>{lead.status === "queued" && <button type="button" onClick={() => void update(lead.id, "sent")} className="rounded-lg bg-violet-500 px-3 py-2 text-xs font-semibold">Mark delivered</button>}{lead.status === "sent" && <button type="button" onClick={() => void update(lead.id, "replaced")} className="rounded-lg border border-amber-300/30 px-3 py-2 text-xs text-amber-100">Mark replacement needed</button>}</div></div></article>)}</div><p className="mt-4 text-xs text-slate-500">Active subscriptions: {subscriptions.length}. Delivery is a human-admin action; Kora does not claim guaranteed lead volume or send unsolicited outreach.</p></section>;
}
