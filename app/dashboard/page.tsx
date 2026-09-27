"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type Role = "owner" | "admin" | "manager" | "employee";
type Customer = { id: string; name: string; email?: string; status: string; createdAt: string };
type Task = { id: string; title: string; status: string; priority: string; createdAt: string };
type Invoice = { id: string; number: string; amount: number; currency?: string; status: string; dueAt?: string; createdAt: string };
type Activity = { id: string; type: string; createdAt: string };
type MemoryRecord = { id: string; entityType: string; title: string; summary: string; status: string; source: string; verificationStatus: string; createdAt: string; data: Record<string, unknown> };
type Profile = { onboardingComplete: boolean; type: string; employees: number; mainChallenge: string; memoryNodes: Array<{ id: string; title: string; content: string }> };
type Action = "customer" | "task" | "invoice" | null;
type Briefing = {
  generatedAt: string;
  items: Array<{ id: string; level: "urgent" | "attention" | "positive"; title: string; detail: string; action?: "invoices" | "tasks" | "customers" }>;
  emptyMessage: string;
  weekly: { revenueRecorded: number; invoicesCreated: number; outstandingInvoices: number; newCustomers: number; tasksCompleted: number; tasksCreated: number; tasksDelayed: number; unavailableMetrics: string[] };
};

const titleCase = (value: string) => value.replace(/[._-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const money = (value: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(value);

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; role: Role } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [memoryRecords, setMemoryRecords] = useState<MemoryRecord[]>([]);
  const [action, setAction] = useState<Action>(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", title: "", number: "", amount: "" });
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkin, setCheckin] = useState({ type: "nothing_significant", note: "" });

  const load = useCallback(async () => {
    const responses = await Promise.all(["workspace", "onboarding", "customers", "tasks", "invoices", "activity", "briefing", "memory"].map((route) => fetch(`/api/${route}`, { cache: "no-store" })));
    if (!responses[0].ok) return router.replace("/");
    const [workspace, onboarding, customerData, taskData, invoiceData, activityData, briefingData, memoryData] = await Promise.all(responses.map((response) => response.json()));
    if (!onboarding.complete && !onboarding.profile?.onboardingComplete) return router.replace("/onboarding");
    setUser(workspace.user); setProfile(onboarding.profile); setCustomers(customerData.data ?? []); setTasks(taskData.data ?? []); setInvoices(invoiceData.data ?? []); setActivity(activityData.data ?? []); setBriefing(responses[6].ok ? briefingData.data : null); setMemoryRecords(responses[7].ok ? memoryData.data ?? [] : []);
  }, [router]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load().catch(() => router.replace("/")).finally(() => setLoading(false)); }, 0);
    return () => window.clearTimeout(timer);
  }, [load, router]);

  const canManage = user?.role === "owner" || user?.role === "admin" || user?.role === "manager";
  const canInvoice = user?.role === "owner" || user?.role === "admin";
  const openInvoices = invoices.filter((invoice) => !["paid", "cancelled"].includes(invoice.status));
  const outstanding = openInvoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
  function openAction(next: Exclude<Action, null>) { setAction(next); setNotice(""); setForm({ name: "", email: "", title: "", number: "", amount: "" }); }
  async function saveAction() {
    if (!action) return;
    const body = action === "customer" ? { name: form.name, email: form.email || undefined } : action === "task" ? { title: form.title, priority: "medium" } : { number: form.number, amount: form.amount };
    setSaving(true); setNotice("");
    try {
      const route = action === "customer" ? "customers" : action === "task" ? "tasks" : "invoices";
      const response = await fetch(`/api/${route}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Unable to save this record.");
      setAction(null); setNotice(`${titleCase(action)} created and added to your operating picture.`); await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to save this record."); } finally { setSaving(false); }
  }
  async function saveCheckin() {
    setSaving(true); setNotice("");
    try {
      const response = await fetch("/api/checkins", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(checkin) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Unable to save your update.");
      setCheckinOpen(false); setCheckin({ type: "nothing_significant", note: "" }); setNotice("Your update is now part of Kora's business memory."); await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to save your update."); } finally { setSaving(false); }
  }
  async function refreshRecommendations() {
    setSaving(true); setNotice("");
    try {
      const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "recommendations" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to review current records.");
      const notStored = Array.isArray(result.data) && result.data.some((recommendation: { persistence?: string }) => recommendation.persistence === "not_configured");
      if (notStored) setNotice("Recommendations were calculated, but durable approval history needs Firebase credentials configured in this deployment.");
      else setNotice(result.data.length ? "Record-based recommendations are ready for your review." : "No urgent recommendations were found in the records Kora can currently access.");
      await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to review current records."); } finally { setSaving(false); }
  }
  async function decideRecommendation(id: string, status: "approved" | "rejected") {
    setSaving(true); setNotice("");
    try {
      const response = await fetch(`/api/memory?id=${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to record this decision.");
      setNotice(status === "approved" ? "Approval recorded. No external action was executed." : "Rejection recorded in business memory."); await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to record this decision."); } finally { setSaving(false); }
  }
  async function signOut() { await fetch("/api/auth/logout", { method: "POST" }); router.replace("/"); router.refresh(); }

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#07070f] text-slate-300"><div className="text-center"><div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" /><p>Loading your workspace…</p></div></main>;
  if (!user || !profile) return null;
  const actions = [{ label: "Add customer", detail: "Capture a new relationship", enabled: canManage, click: () => openAction("customer") }, { label: "Create task", detail: "Keep work moving", enabled: true, click: () => openAction("task") }, { label: "Create invoice", detail: "Start a billing record", enabled: canInvoice, click: () => openAction("invoice") }, { label: "Business update", detail: "Keep Kora current", enabled: true, click: () => setCheckinOpen(true) }];
  const metrics = [["Customers", String(customers.length), "Relationships in your workspace"], ["Open tasks", String(tasks.filter((task) => task.status !== "done").length), "Work that needs attention"], ["Open invoices", String(openInvoices.length), `${money(outstanding)} outstanding`], ["Business memory", String(profile.memoryNodes.length + memoryRecords.length), "Structured notes and record links"]];

  return <main className="min-h-screen bg-[#07070f] pb-12 text-white"><header className="border-b border-white/10 bg-[radial-gradient(circle_at_20%_0%,rgba(124,58,237,0.22),transparent_32%)]"><div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-6 sm:px-8 lg:px-10 md:flex-row md:items-center md:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300">Kora workspace</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Good to see you, {user.name.split(" ")[0]}.</h1><p className="mt-2 text-sm text-slate-400">A current view of the business you are running.</p></div><div className="flex items-center gap-3"><span className="rounded-xl border border-violet-300/20 bg-violet-500/10 px-4 py-2 text-sm text-violet-100">{titleCase(user.role)}</span><button type="button" onClick={signOut} className="rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-300 transition hover:border-white/35 hover:text-white">Sign out</button></div></div></header><div className="mx-auto max-w-7xl space-y-7 px-5 py-7 sm:px-8 lg:px-10">
    {notice && <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-violet-300/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-100"><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Dismiss notification" className="text-lg leading-none">×</button></div>}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value, caption]) => <article key={label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition duration-200 hover:-translate-y-0.5 hover:border-violet-300/35"><p className="text-sm text-slate-400">{label}</p><p className="mt-4 text-3xl font-semibold tracking-tight">{value}</p><p className="mt-2 text-xs text-slate-500">{caption}</p></article>)}</section>
    <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
      <article className="rounded-2xl border border-violet-300/20 bg-gradient-to-br from-violet-500/[0.12] to-[#11111c] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.18em] text-violet-300">Daily briefing · grounded in workspace records</p><h2 className="mt-2 text-xl font-semibold">Here is what deserves your attention</h2></div><span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-400">{briefing ? `Updated ${new Date(briefing.generatedAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}` : "Loading records…"}</span></div>
        <div className="mt-5 space-y-3">{briefing?.items.map((item) => <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><span aria-hidden="true" className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.level === "urgent" ? "bg-rose-400" : item.level === "positive" ? "bg-emerald-400" : "bg-amber-300"}`} /><div><p className="text-sm font-medium">{item.title}</p><p className="mt-1 text-sm leading-5 text-slate-400">{item.detail}</p></div></div>{item.action && <button type="button" onClick={() => document.getElementById(item.action!)?.scrollIntoView({ behavior: "smooth", block: "center" })} className="shrink-0 self-start rounded-lg border border-white/15 px-3 py-2 text-xs text-violet-200 transition hover:border-violet-300/50">Review records</button>}</div>)}{briefing && briefing.items.length === 0 && <p className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-sm leading-6 text-slate-400">{briefing.emptyMessage}</p>}</div>
        <p className="mt-4 text-xs leading-5 text-slate-500">No leads, expenses, or project metrics are included until those records are tracked here.</p>
      </article>
      <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6"><p className="text-xs uppercase tracking-[0.18em] text-violet-300">Week to date</p><h2 className="mt-2 text-xl font-semibold">Operational snapshot</h2><div className="mt-5 grid grid-cols-2 gap-3">{[
        ["Paid invoice value", money(briefing?.weekly.revenueRecorded ?? 0)], ["Outstanding invoices", String(briefing?.weekly.outstandingInvoices ?? "—")], ["New customers", String(briefing?.weekly.newCustomers ?? "—")], ["Tasks completed", `${briefing?.weekly.tasksCompleted ?? "—"} / ${briefing?.weekly.tasksCreated ?? "—"}`],
      ].map(([label, value]) => <div key={label} className="rounded-xl border border-white/5 bg-black/20 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-lg font-semibold">{value}</p></div>)}</div><p className="mt-4 text-xs leading-5 text-slate-500">Revenue is paid invoice value recorded this week. Expenses, leads, deals, and project progress are not yet tracked, so no estimates are shown.</p></article>
    </section>
    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-xs uppercase tracking-[0.18em] text-violet-300">Business memory</p><h2 className="mt-2 text-xl font-semibold">Context that compounds</h2><p className="mt-1 text-sm leading-6 text-slate-400">Structured records are kept separate from chat history and carry their source and verification state.</p></div><button type="button" disabled={!canInvoice || saving} onClick={refreshRecommendations} className="rounded-xl border border-violet-300/30 px-4 py-3 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/10 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Reviewing…" : "Review records for actions"}</button></div>
      {memoryRecords.some((record) => record.entityType === "ai_recommendation" && record.status === "pending_approval") && <div className="mt-5 space-y-3">{memoryRecords.filter((record) => record.entityType === "ai_recommendation" && record.status === "pending_approval").map((record) => <article key={record.id} className="rounded-xl border border-amber-300/20 bg-amber-300/[0.04] p-4"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-center"><div><p className="font-medium">{record.title}</p><p className="mt-1 text-sm text-slate-400">{record.summary}</p><p className="mt-2 text-xs text-slate-500">Source: {record.source} · {record.verificationStatus} · Approval records consent only.</p></div><div className="flex gap-2"><button type="button" disabled={!canInvoice || saving} onClick={() => decideRecommendation(record.id, "approved")} className="rounded-lg bg-violet-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Approve</button><button type="button" disabled={!canInvoice || saving} onClick={() => decideRecommendation(record.id, "rejected")} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-200 disabled:opacity-50">Reject</button></div></div></article>)}</div>}
      <div className="mt-5 grid gap-3 md:grid-cols-2">{memoryRecords.filter((record) => record.entityType !== "ai_recommendation").slice(0, 4).map((record) => <article key={record.id} className="rounded-xl border border-white/5 bg-black/20 p-4"><p className="text-xs uppercase tracking-wider text-slate-500">{titleCase(record.entityType)} · {titleCase(record.source)}</p><h3 className="mt-2 text-sm font-medium">{record.title}</h3><p className="mt-1 text-sm leading-5 text-slate-400">{record.summary}</p><p className="mt-2 text-xs text-slate-500">{titleCase(record.verificationStatus)} · Updated {new Date(record.createdAt).toLocaleDateString("en-NG")}</p></article>)}</div>
      {memoryRecords.length === 0 && <p className="mt-5 rounded-xl border border-dashed border-white/10 px-4 py-4 text-sm leading-6 text-slate-500">New customer, task, invoice, onboarding, and confirmed check-in records become business context. Configure Firebase Admin to persist and retrieve the shared memory catalog.</p>}
    </section>
    <section className="rounded-2xl border border-violet-400/20 bg-gradient-to-r from-violet-500/15 to-fuchsia-500/10 p-5 sm:p-6"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><div><p className="text-lg font-semibold">Keep the operating picture accurate.</p><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-300">Tell Kora about a meaningful change and it is saved as a verified note, scoped to this workspace.</p></div><button type="button" onClick={() => setCheckinOpen(true)} className="shrink-0 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#120b23] transition hover:-translate-y-0.5 hover:bg-violet-100">Add an update</button></div></section>
    <section><div className="mb-3 flex items-end justify-between"><div><p className="text-xs uppercase tracking-[0.18em] text-violet-300">Actions</p><h2 className="mt-1 text-xl font-semibold">Make the next change</h2></div><p className="text-xs text-slate-500">Your role: {titleCase(user.role)}</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{actions.map((item) => <button key={item.label} type="button" disabled={!item.enabled} onClick={item.click} className="group rounded-xl border border-white/10 bg-[#101019] p-5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-violet-300/45 hover:bg-violet-500/10 disabled:cursor-not-allowed disabled:opacity-45"><p className="font-semibold group-hover:text-violet-200">{item.label}</p><p className="mt-2 text-sm text-slate-400">{item.detail}</p>{!item.enabled && <p className="mt-3 text-xs text-amber-300">Requires a higher workspace role</p>}</button>)}</div></section>
    <section className="grid gap-6 lg:grid-cols-2"><Panel id="tasks" title="Recent tasks" eyebrow="Work queue" right={`${tasks.length} total`}>{tasks.slice(0, 6).map((task) => <div key={task.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/20 px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{task.title}</p><p className="mt-1 text-xs text-slate-500">{titleCase(task.priority)} priority</p></div><span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-300">{titleCase(task.status)}</span></div>)}{tasks.length === 0 && <Empty text="No tasks yet. Create one when work needs a clear owner." />}</Panel><Panel title="What changed recently" eyebrow="Business activity" right="Live records">{activity.slice(0, 6).map((event) => <div key={event.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/20 px-4 py-3"><div><p className="text-sm font-medium">{titleCase(event.type)}</p><p className="mt-1 text-xs text-slate-500">{new Date(event.createdAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</p></div><span className="h-2 w-2 shrink-0 rounded-full bg-violet-400" /></div>)}{activity.length === 0 && <Empty text="New customers, tasks and invoices will appear here as they are created." />}</Panel></section>
    <section className="grid gap-6 lg:grid-cols-2"><Panel id="invoices" title="Invoices to review" eyebrow="Billing" right={`${openInvoices.length} open`}>{openInvoices.slice(0, 6).map((invoice) => <div key={invoice.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/20 px-4 py-3"><div><p className="text-sm font-medium">{invoice.number}</p><p className="mt-1 text-xs text-slate-500">{invoice.dueAt ? `Due ${new Date(invoice.dueAt).toLocaleDateString("en-NG")}` : "No due date recorded"}</p></div><div className="text-right"><p className="text-sm">{money(Number(invoice.amount))}</p><p className="mt-1 text-xs text-amber-200">{titleCase(invoice.status)}</p></div></div>)}{openInvoices.length === 0 && <Empty text="No open invoices in the records you can access." />}</Panel><Panel id="customers" title="Recent customers" eyebrow="Relationships" right={`${customers.length} total`}>{customers.slice(0, 6).map((customer) => <div key={customer.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/20 px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{customer.name}</p><p className="mt-1 truncate text-xs text-slate-500">{customer.email || "No email recorded"}</p></div><span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-300">{titleCase(customer.status)}</span></div>)}{customers.length === 0 && <Empty text="No customer records yet." />}</Panel></section>
    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6"><p className="text-xs uppercase tracking-[0.18em] text-violet-300">Business context</p><h2 className="mt-1 text-xl font-semibold">What Kora knows about this workspace</h2><dl className="mt-5 grid gap-4 sm:grid-cols-3"><Detail label="Business type" value={titleCase(profile.type)} /><Detail label="Team size" value={`${profile.employees || 0} people`} /><Detail label="Current focus" value={titleCase(profile.mainChallenge)} /></dl></section>
  </div>{action && <Modal title={`Create ${action}`} onClose={() => setAction(null)}><div className="space-y-3">{action === "customer" && <><Field value={form.name} set={(name) => setForm({ ...form, name })} placeholder="Customer name" /><Field value={form.email} set={(email) => setForm({ ...form, email })} placeholder="Email address (optional)" type="email" /></>}{action === "task" && <Field value={form.title} set={(title) => setForm({ ...form, title })} placeholder="Task title" />}{action === "invoice" && <><Field value={form.number} set={(number) => setForm({ ...form, number })} placeholder="Invoice number" /><Field value={form.amount} set={(amount) => setForm({ ...form, amount })} placeholder="Amount in NGN" type="number" /></>}<button type="button" disabled={saving} onClick={saveAction} className="w-full rounded-xl bg-violet-500 px-4 py-3 font-semibold transition hover:bg-violet-400 disabled:opacity-50">{saving ? "Saving…" : `Create ${action}`}</button></div></Modal>}{checkinOpen && <Modal title="Keep Kora current" onClose={() => setCheckinOpen(false)}><p className="mb-4 text-sm leading-6 text-slate-400">This creates a verified memory note for your workspace.</p><div className="space-y-3"><select value={checkin.type} onChange={(event) => setCheckin({ ...checkin, type: event.target.value })} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none focus:border-violet-400"><option value="hired">We hired someone</option><option value="customer_cancelled">A customer cancelled</option><option value="product_launched">We launched something</option><option value="payment_received">We received a significant payment</option><option value="prices_changed">We changed prices</option><option value="nothing_significant">Nothing significant today</option><option value="other">Something else</option></select><textarea value={checkin.note} onChange={(event) => setCheckin({ ...checkin, note: event.target.value })} maxLength={500} placeholder="Add context (optional)" className="min-h-28 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none focus:border-violet-400" /><button type="button" disabled={saving} onClick={saveCheckin} className="w-full rounded-xl bg-violet-500 px-4 py-3 font-semibold transition hover:bg-violet-400 disabled:opacity-50">{saving ? "Saving…" : "Save update"}</button></div></Modal>}</main>;
}

function Panel({ id, title, eyebrow, right, children }: { id?: string; title: string; eyebrow: string; right: string; children: ReactNode }) { return <article id={id} className="scroll-mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-[0.18em] text-violet-300">{eyebrow}</p><h2 className="mt-1 text-xl font-semibold">{title}</h2></div><span className="text-sm text-slate-500">{right}</span></div><div className="mt-5 space-y-2">{children}</div></article>; }
function Field({ value, set, placeholder, type = "text" }: { value: string; set: (value: string) => void; placeholder: string; type?: string }) { return <input required value={value} onChange={(event) => set(event.target.value)} placeholder={placeholder} type={type} min={type === "number" ? "1" : undefined} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none placeholder:text-slate-500 focus:border-violet-400" />; }
function Empty({ text }: { text: string }) { return <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm leading-6 text-slate-500">{text}</p>; }
function Detail({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/5 bg-black/20 p-4"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-2 text-sm font-medium">{value}</dd></div>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}><div className="w-full max-w-md rounded-2xl border border-violet-300/25 bg-[#11111c] p-5 shadow-2xl sm:p-6"><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-semibold">{title}</h2><button type="button" onClick={onClose} aria-label="Close dialog" className="rounded-lg px-2 py-1 text-xl text-slate-400 transition hover:bg-white/10 hover:text-white">×</button></div>{children}</div></div>; }
