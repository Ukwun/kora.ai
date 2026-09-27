"use client";

import { useCallback, useEffect, useState } from "react";

type Kind = "lead" | "expense" | "project" | "product" | "service";
type RecordItem = { id: string; entityType: Kind; title: string; summary: string; createdAt: string; data: Record<string, unknown> };
const kinds: { id: Kind; label: string }[] = [{ id: "lead", label: "Lead" }, { id: "expense", label: "Expense" }, { id: "project", label: "Project" }, { id: "product", label: "Product" }, { id: "service", label: "Service" }];

export default function OperationalRecords({ canManage }: { canManage: boolean }) {
  const [kind, setKind] = useState<Kind>("lead");
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch("/api/records", { cache: "no-store" });
    if (response.ok) { const body = await response.json(); setRecords(body.data ?? []); }
    else if (response.status === 503) setNotice("Configure Firebase Admin to save and share these structured records.");
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  function changeKind(value: Kind) { setKind(value); setFields({}); setNotice(""); }
  function field(key: string, label: string, type = "text", optional = false) {
    return <label key={key} className="block text-xs text-slate-400">{label}{optional && " (optional)"}<input value={fields[key] ?? ""} onChange={(event) => setFields((old) => ({ ...old, [key]: event.target.value }))} type={type} required={!optional} min={type === "number" ? "0" : undefined} className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400" /></label>;
  }
  async function save() {
    const number = (key: string) => Number(fields[key]);
    const date = (key: string) => new Date(fields[key]).toISOString();
    let data: Record<string, unknown>;
    if (kind === "lead") data = { name: fields.name, company: fields.company || undefined, email: fields.email || undefined, phone: fields.phone || undefined, stage: fields.stage || "new", value: fields.value ? number("value") : undefined, currency: fields.currency || "NGN", followUpAt: fields.followUpAt ? date("followUpAt") : undefined, notes: fields.notes || undefined };
    else if (kind === "expense") data = { description: fields.description, amount: number("amount"), currency: fields.currency || "NGN", category: fields.category, supplier: fields.supplier || undefined, occurredAt: date("occurredAt"), paymentMethod: fields.paymentMethod || undefined };
    else if (kind === "project") data = { name: fields.name, status: fields.status || "planned", customer: fields.customer || undefined, dueAt: fields.dueAt ? date("dueAt") : undefined, budget: fields.budget ? number("budget") : undefined, currency: fields.currency || "NGN", progress: fields.progress ? number("progress") : 0 };
    else if (kind === "product") data = { name: fields.name, sku: fields.sku || undefined, price: number("price"), cost: fields.cost ? number("cost") : undefined, currency: fields.currency || "NGN", stock: fields.stock ? number("stock") : undefined, reorderLevel: fields.reorderLevel ? number("reorderLevel") : undefined };
    else data = { name: fields.name, price: number("price"), currency: fields.currency || "NGN", billingUnit: fields.billingUnit || undefined, description: fields.description || undefined };
    setSaving(true); setNotice("");
    try { const response = await fetch("/api/records", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entityType: kind, data }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error || "Unable to save record."); setFields({}); setNotice(`${kinds.find((item) => item.id === kind)?.label} saved to this workspace.`); await load(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Unable to save record."); } finally { setSaving(false); }
  }
  return <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6"><div><p className="text-xs uppercase tracking-[0.18em] text-violet-300">Operational records</p><h2 className="mt-1 text-xl font-semibold">Build a reliable business picture</h2><p className="mt-1 text-sm leading-6 text-slate-400">Capture leads, spending, projects, products, and services. Reports and recommendations only use saved records.</p></div><div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"><div><div className="flex flex-wrap gap-2">{kinds.map((item) => <button key={item.id} type="button" onClick={() => changeKind(item.id)} aria-pressed={kind === item.id} className={`rounded-lg border px-3 py-2 text-sm transition ${kind === item.id ? "border-violet-300/50 bg-violet-500/15 text-violet-100" : "border-white/10 text-slate-400 hover:bg-white/5"}`}>{item.label}</button>)}</div>{canManage ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{kind === "lead" && <>{field("name", "Contact name")}{field("company", "Company", "text", true)}{field("email", "Email", "email", true)}{field("phone", "Phone", "text", true)}<label className="text-xs text-slate-400">Stage<select value={fields.stage ?? "new"} onChange={(event) => setFields({ ...fields, stage: event.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-[#11111c] px-3 py-2.5 text-sm"><option value="new">New</option><option value="qualified">Qualified</option><option value="proposal">Proposal</option><option value="won">Won</option><option value="lost">Lost</option></select></label>{field("value", "Potential value", "number", true)}{field("followUpAt", "Follow-up date", "date", true)}</>}{kind === "expense" && <>{field("description", "Expense")}{field("amount", "Amount", "number")}{field("category", "Category")}{field("supplier", "Supplier", "text", true)}{field("occurredAt", "Date", "date")}{field("paymentMethod", "Payment method", "text", true)}</>}{kind === "project" && <>{field("name", "Project name")}{field("customer", "Customer", "text", true)}{field("dueAt", "Due date", "date", true)}{field("budget", "Budget", "number", true)}{field("progress", "Progress %", "number", true)}<label className="text-xs text-slate-400">Status<select value={fields.status ?? "planned"} onChange={(event) => setFields({ ...fields, status: event.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-[#11111c] px-3 py-2.5 text-sm"><option value="planned">Planned</option><option value="active">Active</option><option value="on_hold">On hold</option><option value="completed">Completed</option></select></label></>}{(kind === "product" || kind === "service") && <>{field("name", `${kind === "product" ? "Product" : "Service"} name`)}{field("price", "Price", "number")}{field("currency", "Currency (ISO)", "text", true)}{kind === "product" ? <>{field("sku", "SKU", "text", true)}{field("cost", "Unit cost", "number", true)}{field("stock", "Stock on hand", "number", true)}{field("reorderLevel", "Reorder level", "number", true)}</> : <>{field("billingUnit", "Billing unit", "text", true)}{field("description", "Description", "text", true)}</>}</>}</div> : <p className="mt-4 text-sm text-slate-500">Your workspace role does not allow creating shared records.</p>}{canManage && <button type="button" disabled={saving} onClick={save} className="mt-4 w-full rounded-xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:opacity-50">{saving ? "Saving…" : `Save ${kind}`}</button>}{notice && <p role="status" className="mt-3 text-sm text-violet-200">{notice}</p>}</div><div className="space-y-2">{records.slice(0, 8).map((record) => <article key={record.id} className="rounded-xl border border-white/5 bg-black/20 px-4 py-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium">{record.title}</p><p className="mt-1 text-xs text-slate-400">{record.summary}</p></div><span className="rounded-full bg-white/5 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-400">{record.entityType}</span></div><p className="mt-2 text-[11px] text-slate-600">Recorded {new Date(record.createdAt).toLocaleDateString()}</p></article>)}{records.length === 0 && <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm leading-6 text-slate-500">No structured operational records yet. Add one to start building evidence for business insights.</p>}</div></div></section>;
}

export function WeeklyBusinessReport() {
  const [report, setReport] = useState<{ period: { label: string; start: string; end: string }; metrics: Record<string, { value?: number; count?: number; averageProgress?: number | null; won?: number; lost?: number; totalCreated?: number; overdueValue?: number; products?: number; services?: number; available: boolean; emptyReason?: string; currency?: string }>; caveat: string } | null>(null);
  useEffect(() => { const timer = window.setTimeout(() => { void fetch("/api/weekly-report", { cache: "no-store" }).then(async (response) => response.ok ? response.json() : null).then((body) => setReport(body?.data ?? null)).catch(() => setReport(null)); }, 0); return () => window.clearTimeout(timer); }, []);
  if (!report) return null;
  const fmt = (value: number, currency = "NGN") => new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  const metrics = report.metrics;
  const cards = [
    ["Paid invoices", metrics.paidInvoiceValue.available ? `${fmt(metrics.paidInvoiceValue.value ?? 0)} · ${metrics.paidInvoiceValue.count ?? 0} records` : "Unavailable"],
    ["Outstanding invoices", `${metrics.outstandingInvoices.value ?? 0} · ${fmt(metrics.outstandingInvoices.overdueValue ?? 0)} overdue`],
    ["New customers", String(metrics.newCustomers.value ?? 0)],
    ["Tasks completed", `${metrics.tasksCompleted.value ?? 0} / ${metrics.tasksCompleted.totalCreated ?? 0}`],
    ["Expenses recorded", metrics.expenses.available ? `${fmt(metrics.expenses.value ?? 0, metrics.expenses.currency)} · ${metrics.expenses.count ?? 0} records` : "No records yet"],
    ["Lead outcomes", metrics.leads.available ? `${metrics.leads.won ?? 0} won · ${metrics.leads.lost ?? 0} lost` : "No records yet"],
    ["Project progress", metrics.projects.available ? `${metrics.projects.averageProgress ?? 0}% average · ${metrics.projects.value ?? 0} projects` : "No records yet"],
    ["Catalog", metrics.productsAndServices.available ? `${metrics.productsAndServices.products ?? 0} products · ${metrics.productsAndServices.services ?? 0} services` : "No records yet"],
  ] as const;
  return <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6"><div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><p className="text-xs uppercase tracking-[0.18em] text-violet-300">Weekly business review</p><h2 className="mt-1 text-xl font-semibold">{report.period.label}</h2></div><p className="text-xs text-slate-500">{new Date(report.period.start).toLocaleDateString()} – {new Date(report.period.end).toLocaleDateString()}</p></div><div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{cards.map(([label, value]) => <article key={label} className="rounded-xl border border-white/5 bg-black/20 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-sm font-semibold text-slate-100">{value}</p></article>)}</div><p className="mt-4 text-xs leading-5 text-slate-500">{report.caveat} Delivery through PDF, email, or WhatsApp is not configured yet.</p></section>;
}

export function BusinessProfileEditor({ canEdit }: { canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  async function openEditor() {
    setNotice("");
    const response = await fetch("/api/onboarding", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) { setNotice(result.error || "Unable to load business profile."); return; }
    setProfile(result.profile ?? {}); setOpen(true);
  }
  const text = (key: string) => Array.isArray(profile[key]) ? (profile[key] as string[]).join(", ") : String(profile[key] ?? "");
  const update = (key: string, value: string) => setProfile((old) => ({ ...old, [key]: value }));
  async function save() {
    setSaving(true); setNotice("");
    const list = (key: string) => text(key).split(",").map((value) => value.trim()).filter(Boolean);
    const draft: Record<string, unknown> = { businessName: text("businessName"), industry: text("industry"), type: text("type"), country: text("country"), currency: text("currency").toUpperCase(), timezone: text("timezone"), employees: text("employees") ? Number(profile.employees) : undefined, customersPerMonth: text("customersPerMonth") ? Number(profile.customersPerMonth) : undefined, monthlyRevenueRange: text("monthlyRevenueRange"), offerings: list("offerings"), goals: list("goals"), existingSoftware: list("existingSoftware"), communicationChannels: list("communicationChannels"), preferredPaymentMethods: list("preferredPaymentMethods"), workingHours: text("workingHours"), reportingPreferences: list("reportingPreferences") };
    const body = Object.fromEntries(Object.entries(draft).filter(([, value]) => value !== "" && value !== undefined));
    try { const response = await fetch("/api/onboarding", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Unable to save profile."); setProfile(result.profile); setNotice("Business profile updated. Kora will use this as your latest owner-provided context."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Unable to save profile."); }
    finally { setSaving(false); }
  }
  const input = (key: string, label: string, type = "text") => <label key={key} className="block text-xs text-slate-400">{label}<input type={type} value={text(key)} onChange={(event) => update(key, event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400" /></label>;
  return <><button type="button" disabled={!canEdit} onClick={() => void openEditor()} className="mt-4 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 transition hover:border-violet-300/40 hover:text-white disabled:opacity-40">Edit business profile</button>{notice && !open && <p role="status" className="mt-2 text-xs text-amber-200">{notice}</p>}{open && <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Edit business profile"><section className="mx-auto my-8 w-full max-w-3xl rounded-2xl border border-violet-300/20 bg-[#11111c] p-5 sm:p-7"><div className="flex items-start justify-between"><div><p className="text-xs uppercase tracking-widest text-violet-300">Workspace settings</p><h2 className="mt-2 text-2xl font-semibold">Business profile</h2><p className="mt-2 text-sm text-slate-400">These are owner-provided estimates. Update them whenever they change.</p></div><button type="button" aria-label="Close editor" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-slate-400 hover:bg-white/10">×</button></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{input("businessName", "Business name")}{input("industry", "Industry")}{input("country", "Country")}{input("currency", "Currency code")}{input("timezone", "Timezone")}{input("employees", "Employees", "number")}{input("customersPerMonth", "Approximate monthly customers", "number")}{input("monthlyRevenueRange", "Monthly revenue range code")}{input("offerings", "Products or services (comma separated)")}{input("goals", "Business goals (comma separated)")}{input("existingSoftware", "Current tools (comma separated)")}{input("communicationChannels", "Preferred communication channels (comma separated)")}{input("preferredPaymentMethods", "Payment methods (comma separated)")}{input("reportingPreferences", "Reporting preferences (comma separated)")}{input("workingHours", "Working hours")}</div>{notice && <p role="status" className="mt-4 rounded-lg bg-violet-500/10 px-3 py-2 text-sm text-violet-100">{notice}</p>}<button type="button" disabled={saving} onClick={() => void save()} className="mt-5 w-full rounded-xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:opacity-50">{saving ? "Saving…" : "Save profile"}</button></section></div>}</>;
}
