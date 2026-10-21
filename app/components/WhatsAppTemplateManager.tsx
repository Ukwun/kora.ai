"use client";

import { useEffect, useState } from "react";

type Template = { id: string; name: string; language: string; category: string; body: string; status: string; reviewNote?: string };

export default function WhatsAppTemplateManager() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [visible, setVisible] = useState(true);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ name: "", language: "en", category: "utility", body: "" });

  async function load() {
    const response = await fetch("/api/integrations/whatsapp/templates", { cache: "no-store" });
    if (response.status === 403 || response.status === 503) { setVisible(false); return; }
    const result = await response.json();
    if (response.ok) setTemplates(result.data ?? []);
  }
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/integrations/whatsapp/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const result = await response.json();
    setNotice(response.ok ? result.message : result.error ?? "Could not submit template.");
    if (response.ok) { setForm({ name: "", language: "en", category: "utility", body: "" }); await load(); }
  }

  async function review(id: string, decision: "approved" | "rejected") {
    const response = await fetch("/api/integrations/whatsapp/templates", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, decision }) });
    setNotice(response.ok ? `Template ${decision}. Meta approval is still required.` : "Could not review template.");
    if (response.ok) await load();
  }

  if (!visible) return null;
  return <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6"><div><p className="text-xs uppercase tracking-[0.18em] text-slate-400">WhatsApp templates</p><h2 className="mt-2 text-xl font-semibold">Approved messaging only</h2><p className="mt-1 text-sm leading-6 text-slate-400">Submit a template for internal review, then submit approved content to Meta. Untemplated marketing messages remain blocked.</p></div><form onSubmit={submit} className="mt-5 grid gap-3 md:grid-cols-4"><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Template name" className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm" /><input required value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value })} placeholder="Language" className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm" /><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"><option value="utility">Utility</option><option value="marketing">Marketing</option><option value="authentication">Authentication</option></select><input required value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="Message body" className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm md:col-span-3" /><button type="submit" className="rounded-lg bg-violet-500 px-3 py-2 text-sm font-semibold">Submit for review</button></form>{notice && <p role="status" className="mt-3 text-sm text-emerald-200">{notice}</p>}<div className="mt-5 space-y-2">{templates.map((template) => <div key={template.id} className="flex flex-col justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3 md:flex-row md:items-center"><div><p className="text-sm font-medium">{template.name} <span className="ml-2 text-xs text-slate-500">{template.status}</span></p><p className="mt-1 text-sm text-slate-400">{template.body}</p></div>{template.status === "pending_approval" && <div className="flex gap-2"><button type="button" onClick={() => void review(template.id, "approved")} className="rounded-lg bg-emerald-500/20 px-3 py-2 text-xs text-emerald-100">Approve</button><button type="button" onClick={() => void review(template.id, "rejected")} className="rounded-lg border border-white/15 px-3 py-2 text-xs">Reject</button></div>}</div>)}</div></section>;
}
