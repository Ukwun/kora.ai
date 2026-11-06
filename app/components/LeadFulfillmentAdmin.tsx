"use client";

import { useEffect, useState } from "react";

type QueueRecord = { id: string; entityType: string; title: string; summary: string; status: string; data: Record<string, unknown> & { packageLabel?: string; requestedVolume?: number; proposedPriceNGN?: number; fulfillmentStatus?: string; targeting?: { country?: string } }; createdAt: string };

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

  async function update(id: string, action: { deliveryStatus: "sent" | "rejected" | "replaced" } | { reviewDecision: "approve_brief" | "custom_quote" | "unavailable"; note?: string }) {
    const response = await fetch("/api/lead-service/fulfillment", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...action }) });
    const result = await response.json();
    setNotice(response.ok ? ("reviewDecision" in action ? "Package review updated." : "Lead fulfilment status updated.") : result.error ?? "Could not update lead status.");
    if (response.ok) await load();
  }

  if (forbidden || !records.length) return null;
  const packageRequests = records.filter((record) => record.entityType === "lead_request");
  const legacySubscriptions = records.filter((record) => record.entityType === "lead_subscription" && record.status === "active");
  const leads = records.filter((record) => record.entityType === "lead_delivery");
  return <section className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.04] p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.18em] text-amber-200">Admin fulfilment</p><h2 className="mt-2 text-xl font-semibold">Lead service operations</h2><p className="mt-1 text-sm leading-6 text-slate-400">Package reviews are not purchases. Payment and fulfilment remain unavailable until sourcing, checkout, and compliance are approved.</p></div>{notice && <p role="status" className="text-sm text-emerald-200">{notice}</p>}</div>
    {packageRequests.length > 0 && <div className="mt-5"><h3 className="text-sm font-medium text-slate-200">Package availability reviews</h3><div className="mt-3 space-y-3">{packageRequests.map((item) => <article key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-4"><p className="font-medium">{String(item.data.packageLabel ?? item.title)}</p><p className="mt-1 text-sm text-slate-400">{String(item.data.requestedVolume ?? "Custom")} prospects · {String(item.data.proposedPriceNGN ? `₦${Number(item.data.proposedPriceNGN).toLocaleString("en-NG")} proposed test price` : "custom quote")} · {String(item.data.targeting?.country ?? "Target country not recorded")}</p><p className="mt-2 text-xs text-amber-200">{item.data.fulfillmentStatus === "brief_approved" ? "Brief and availability approved · awaiting final offer and payment" : item.data.fulfillmentStatus === "custom_quote_required" ? "Custom quote required" : item.data.fulfillmentStatus === "unavailable" ? "Not available" : "Review pending · no payment or delivery started"}</p>{item.data.fulfillmentStatus === "availability_review_required" && <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void update(item.id, { reviewDecision: "approve_brief" })} className="rounded-lg bg-violet-500 px-3 py-2 text-xs font-semibold">Approve brief &amp; availability</button><button type="button" onClick={() => void update(item.id, { reviewDecision: "custom_quote", note: "The requested market or decision-maker profile needs a custom quote." })} className="rounded-lg border border-violet-300/30 px-3 py-2 text-xs text-violet-100">Request custom quote</button><button type="button" onClick={() => void update(item.id, { reviewDecision: "unavailable", note: "The requested package is not currently available." })} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300">Mark unavailable</button></div>}</article>)}</div></div>}
    {leads.length > 0 && <div className="mt-5 space-y-3">{leads.map((lead) => <article key={lead.id} className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="flex flex-col justify-between gap-3 md:flex-row md:items-start"><div><p className="font-medium">{lead.title}</p><p className="mt-1 text-sm text-slate-400">{lead.summary}</p><p className="mt-2 text-xs text-slate-500">Source: {String(lead.data.source)} · Consent: {String(lead.data.consentStatus)} · Quality: {String(lead.data.qualityScore)}/5 · Opt out: {String(lead.data.optOutMethod)}</p></div><div className="flex flex-wrap gap-2"><span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-slate-300">{lead.status}</span>{lead.status === "queued" && <button type="button" onClick={() => void update(lead.id, { deliveryStatus: "sent" })} className="rounded-lg bg-violet-500 px-3 py-2 text-xs font-semibold">Mark delivered</button>}{lead.status === "sent" && <button type="button" onClick={() => void update(lead.id, { deliveryStatus: "replaced" })} className="rounded-lg border border-amber-300/30 px-3 py-2 text-xs text-amber-100">Mark replacement needed</button>}</div></div></article>)}</div>}
    {legacySubscriptions.length > 0 && <p className="mt-4 text-xs text-slate-500">Legacy monthly subscriptions: {legacySubscriptions.length}. New lead service requests use one-time packages.</p>}
    <p className="mt-4 text-xs text-slate-500">Delivery status is a human-admin action; Kora does not claim guaranteed results or send unsolicited outreach.</p></section>;
}
