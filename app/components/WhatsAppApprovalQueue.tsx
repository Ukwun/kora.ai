"use client";

import { useEffect, useState } from "react";

type Message = { id: string; body: string; toPhone?: string; status: string; consentStatus: string; createdAt: string };

export default function WhatsAppApprovalQueue() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [visible, setVisible] = useState(true);
  const [notice, setNotice] = useState("");

  async function load() {
    const response = await fetch("/api/integrations/whatsapp/messages", { cache: "no-store" });
    if (response.status === 403) { setVisible(false); return; }
    const result = await response.json();
    if (!response.ok) { setVisible(false); return; }
    setMessages((result.data ?? []).filter((message: Message) => ["pending_approval", "approved", "failed"].includes(message.status)));
  }
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, []);

  async function decide(id: string, decision: "approved" | "rejected") {
    const response = await fetch("/api/integrations/whatsapp/messages", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, decision }) });
    const result = await response.json();
    setNotice(response.ok ? result.message : result.error ?? "Could not update the message.");
    if (response.ok) await load();
  }

  if (!visible || !messages.length) return null;
  return <section className="rounded-2xl border border-rose-300/20 bg-rose-500/[0.04] p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.18em] text-rose-200">Human approval required</p><h2 className="mt-2 text-xl font-semibold">WhatsApp outbound queue</h2><p className="mt-1 text-sm leading-6 text-slate-400">Kora never sends an AI-generated message automatically. Verify consent, content, recipient, and timing before approval.</p></div>{notice && <p role="status" className="text-sm text-emerald-200">{notice}</p>}</div><div className="mt-5 space-y-3">{messages.map((message) => <article key={message.id} className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="flex flex-col justify-between gap-3 md:flex-row md:items-start"><div><p className="text-sm text-slate-400">To {message.toPhone ?? "unknown"} · consent: {message.consentStatus} · {message.status}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.body}</p></div>{message.status === "pending_approval" && <div className="flex shrink-0 gap-2"><button type="button" onClick={() => void decide(message.id, "approved")} className="rounded-lg bg-violet-500 px-3 py-2 text-xs font-semibold">Approve</button><button type="button" onClick={() => void decide(message.id, "rejected")} className="rounded-lg border border-white/15 px-3 py-2 text-xs">Reject</button></div>}</div></article>)}</div></section>;
}
