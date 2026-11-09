"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

type AdminMember = { id: string; name: string; email: string; role: string };
type AdminBusiness = {
  id: string;
  name: string;
  industry: string;
  createdAt: string;
  userCount: number;
  subscriberCount: number;
  taskCount: number;
  taskTakerCount: number;
  complaintCount: number;
  lastActivityAt?: string;
  members: AdminMember[];
};
type AdminActivity = {
  id: string;
  type: string;
  entityType: string;
  title: string;
  summary: string;
  organizationId: string;
  organizationName: string;
  actorName?: string;
  createdAt: string;
};
type AdminComplaint = {
  id: string;
  organizationId: string;
  organizationName: string;
  title: string;
  summary: string;
  category: string;
  status: string;
  submittedBy: string;
  createdAt: string;
};
type AdminOverview = {
  generatedAt: string;
  metrics: {
    users: number;
    businesses: number;
    subscribers: number;
    tasks: number;
    taskTakers: number;
    complaints: number;
    activitiesToday: number;
  };
  series: Array<{ date: string; label: string; tasks: number; activities: number; businesses: number }>;
  businesses: AdminBusiness[];
  recentActivities: AdminActivity[];
  complaints: AdminComplaint[];
  dataWarnings: string[];
};

const fieldClass = "mt-1 w-full rounded-xl border border-white/10 bg-[#0b0b14] px-3 py-2.5 text-sm text-white outline-none transition focus:border-violet-300/50";
const buttonClass = "rounded-xl border border-violet-300/30 bg-violet-500/10 px-4 py-2.5 text-sm font-medium text-violet-100 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50";
const metricLabels: Array<[keyof AdminOverview["metrics"], string, string]> = [
  ["users", "Users", "Registered accounts across businesses"],
  ["businesses", "Businesses", "Workspaces with current system records"],
  ["subscribers", "Subscribers", "Active or trial business subscriptions"],
  ["tasks", "Tasks", "Recorded tasks across businesses"],
  ["taskTakers", "Task takers", "Unique users assigned at least one task"],
  ["complaints", "Complaints", "Submitted business support complaints"],
];

function Sparkline({ series }: { series: AdminOverview["series"] }) {
  const max = Math.max(1, ...series.map((point) => point.activities));
  const points = series.map((point, index) => {
    const x = series.length < 2 ? 50 : (index / (series.length - 1)) * 100;
    const y = 90 - (point.activities / max) * 76;
    return `${x},${y}`;
  }).join(" ");
  return <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Daily business activities over the last two weeks" className="h-48 w-full overflow-visible">
    <defs><linearGradient id="activity-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#a78bfa" stopOpacity=".34" /><stop offset="100%" stopColor="#a78bfa" stopOpacity="0" /></linearGradient></defs>
    {[20, 45, 70, 95].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="rgba(255,255,255,.09)" strokeDasharray="1 2" vectorEffect="non-scaling-stroke" />)}
    {series.length > 1 && <polygon points={`0,100 ${points} 100,100`} fill="url(#activity-area)" />}
    <polyline points={points} fill="none" stroke="#c4b5fd" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    {series.map((point, index) => {
      const x = series.length < 2 ? 50 : (index / (series.length - 1)) * 100;
      const y = 90 - (point.activities / max) * 76;
      return <circle key={point.date} cx={x} cy={y} r="1.25" fill="#ddd6fe"><title>{point.label}: {point.activities} recorded activities</title></circle>;
    })}
  </svg>;
}

function ActivityBars({ series }: { series: AdminOverview["series"] }) {
  const max = Math.max(1, ...series.map((point) => point.tasks));
  return <div role="img" aria-label="Daily task creation over the last two weeks" className="flex h-48 items-end gap-1.5 border-b border-white/10 px-1">
    {series.map((point) => <div key={point.date} className="group relative flex h-full min-w-0 flex-1 items-end" title={`${point.label}: ${point.tasks} tasks`}>
      <div className="w-full rounded-t-sm bg-gradient-to-t from-violet-600/80 to-fuchsia-300/90 transition-colors group-hover:from-violet-400 group-hover:to-fuchsia-200" style={{ height: `${Math.max(point.tasks ? 5 : 1, (point.tasks / max) * 92)}%` }} />
      <span className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-[#151322] px-2 py-1 text-[10px] text-slate-200 group-hover:block">{point.label} · {point.tasks}</span>
    </div>)}
  </div>;
}

function ActivityIllustration({ type }: { type: string }) {
  const isComplaint = /complaint|support|issue/i.test(type);
  const isTask = /task/i.test(type);
  const color = isComplaint ? "#fb7185" : isTask ? "#c4b5fd" : "#67e8f9";
  return <svg aria-hidden="true" viewBox="0 0 56 56" className="h-12 w-12 shrink-0">
    <circle cx="28" cy="28" r="25" fill={color} fillOpacity=".08" />
    <path d="M12 37c5-7 9-5 13-12s8-7 12-4 5 7 8 6" fill="none" stroke={color} strokeOpacity=".35" strokeWidth="1.5" />
    {isComplaint
      ? <><path d="M28 12 44 40H12L28 12Z" fill={color} fillOpacity=".15" stroke={color} strokeWidth="1.5" /><path d="M28 22v8m0 4h.01" stroke={color} strokeWidth="2" strokeLinecap="round" /></>
      : isTask
        ? <><rect x="14" y="13" width="28" height="31" rx="5" fill="#0d0b16" stroke={color} strokeWidth="1.5" /><path d="m20 25 3 3 6-7m-9 13h16" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></>
        : <><circle cx="28" cy="22" r="7" fill={color} fillOpacity=".18" stroke={color} strokeWidth="1.5" /><path d="M16 42c1-8 5-12 12-12s11 4 12 12" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" /><circle cx="42" cy="14" r="2" fill={color} /></>}
  </svg>;
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}

export default function AdminPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [adminRole, setAdminRole] = useState<"super_admin" | "admin" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [task, setTask] = useState({ organizationId: "", assignedTo: "", title: "", description: "", priority: "medium" });
  const [suggestion, setSuggestion] = useState({ organizationId: "", title: "", summary: "" });

  const loadOverview = useCallback(async () => {
    const response = await fetch("/api/platform-admin/overview", { cache: "no-store" });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.error ?? "The platform overview could not be loaded.");
    setOverview(result.data);
    setAdminRole(result.adminRole);
    setTask((current) => ({ ...current, organizationId: current.organizationId || result.data.businesses[0]?.id || "" }));
    setSuggestion((current) => ({ ...current, organizationId: current.organizationId || result.data.businesses[0]?.id || "" }));
    setError("");
  }, []);

  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    const refresh = async () => {
      if (disposed || inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      try { await loadOverview(); }
      catch (cause) { if (!disposed) setError(cause instanceof Error ? cause.message : "The platform overview could not be loaded."); }
      finally { inFlight = false; if (!disposed) setLoading(false); }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 15_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { disposed = true; window.clearInterval(interval); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [loadOverview]);

  const selectedBusiness = useMemo(() => overview?.businesses.find((business) => business.id === task.organizationId) ?? null, [overview, task.organizationId]);

  async function submitAction(event: FormEvent<HTMLFormElement>, endpoint: "tasks" | "suggestions", body: object) {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/platform-admin/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "The action could not be saved.");
      setNotice(result.message ?? "The update was saved and sent to the business.");
      if (endpoint === "tasks") setTask((current) => ({ ...current, title: "", description: "" }));
      else setSuggestion((current) => ({ ...current, title: "", summary: "" }));
      await loadOverview();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The action could not be saved."); }
    finally { setSaving(false); }
  }

  async function updateComplaint(complaint: AdminComplaint, status: "under_review" | "resolved" | "dismissed") {
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/platform-admin/complaints", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: complaint.organizationId, complaintId: complaint.id, status }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "The complaint status could not be updated.");
      setNotice("Complaint status updated and the business contact was notified.");
      await loadOverview();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The complaint status could not be updated."); }
    finally { setSaving(false); }
  }

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#080711] text-slate-300"><p>Loading platform operations…</p></main>;
  if (error && !overview) return <main className="grid min-h-screen place-items-center bg-[#080711] px-5 text-white"><section className="max-w-md rounded-2xl border border-rose-300/20 bg-rose-500/[0.06] p-6 text-center"><h1 className="text-xl font-semibold">Platform access unavailable</h1><p role="alert" className="mt-3 text-sm leading-6 text-slate-300">{error}</p><a href="/dashboard" className="mt-5 inline-flex rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-200">Return to workspace</a></section></main>;
  if (!overview) return null;

  return <main className="min-h-screen bg-[#080711] px-4 py-6 text-white sm:px-7 lg:px-10">
    <div className="mx-auto max-w-7xl space-y-7">
      <header className="relative overflow-hidden rounded-3xl border border-violet-300/15 bg-[radial-gradient(ellipse_at_80%_10%,rgba(124,58,237,0.28),transparent_38%),linear-gradient(130deg,#171128,#0b0a13_65%)] p-6 sm:p-9">
        <div className="pointer-events-none absolute -right-10 -top-16 h-64 w-64 rounded-full border border-violet-200/10" /><div className="pointer-events-none absolute right-8 top-8 h-40 w-40 rounded-full border border-violet-200/10" />
        <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300">Kora · platform operations</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{adminRole === "super_admin" ? "Super admin command" : "Admin operations"}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Cross-business activity, support signals, and team follow-through, grounded in records from the platform.</p></div>
          <div className="flex flex-wrap items-center gap-3"><span className="flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/[0.06] px-3 py-2 text-xs text-emerald-100"><i className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" /> Refreshes every 15 seconds</span><a href="/dashboard" className={buttonClass}>Business workspace ↗</a></div>
        </div>
        <div className="relative mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {metricLabels.map(([key, label, caption]) => <article key={key} className="rounded-2xl border border-white/10 bg-black/20 p-4 backdrop-blur"><p className="text-xs text-slate-400">{label}</p><p className="mt-3 text-3xl font-semibold tabular-nums">{overview.metrics[key].toLocaleString("en-NG")}</p><p className="mt-2 text-[11px] leading-4 text-slate-500">{caption}</p></article>)}
        </div>
        <p className="relative mt-4 text-xs text-slate-500">Activity today: {overview.metrics.activitiesToday.toLocaleString("en-NG")} records · Last refreshed {formatTime(overview.generatedAt)} · Counts are based on currently available platform records.</p>
      </header>

      {error && <p role="alert" className="rounded-xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">Could not refresh the latest overview: {error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{notice}</p>}
      {overview.dataWarnings.map((warning) => <p key={warning} role="status" className="rounded-xl border border-amber-300/20 bg-amber-500/[0.07] px-4 py-3 text-sm text-amber-100">{warning}</p>)}

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
          <div><p className="text-xs uppercase tracking-[0.18em] text-violet-300">Activity histogram · 14 days</p><h2 className="mt-2 text-lg font-semibold">Business activity, day by day</h2><p className="mt-1 text-xs text-slate-500">Recorded product events; this is not a forecast.</p></div>
          <div className="mt-5"><Sparkline series={overview.series} /></div>
          <div className="mt-2 flex justify-between text-[10px] text-slate-500"><span>{overview.series[0]?.label}</span><span>{overview.series.at(-1)?.label}</span></div>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
          <div><p className="text-xs uppercase tracking-[0.18em] text-fuchsia-200">Task histogram · 14 days</p><h2 className="mt-2 text-lg font-semibold">New work created</h2><p className="mt-1 text-xs text-slate-500">Each bar represents tasks created across all businesses that day.</p></div>
          <div className="mt-5"><ActivityBars series={overview.series} /></div>
          <div className="mt-2 flex justify-between text-[10px] text-slate-500"><span>{overview.series[0]?.label}</span><span>{overview.series.at(-1)?.label}</span></div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <form onSubmit={(event) => void submitAction(event, "tasks", task)} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
          <div><p className="text-xs uppercase tracking-[0.18em] text-violet-300">Direct follow-through</p><h2 className="mt-2 text-lg font-semibold">Assign a task to a business</h2><p className="mt-1 text-xs leading-5 text-slate-500">Tasks are written into the selected business workspace and assigned only to its active members.</p></div>
          <label className="block text-sm text-slate-300">Business<select required value={task.organizationId} onChange={(event) => setTask({ ...task, organizationId: event.target.value, assignedTo: "" })} className={fieldClass}><option value="">Select a business</option>{overview.businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}</select></label>
          <label className="block text-sm text-slate-300">Task title<input required minLength={2} maxLength={160} value={task.title} onChange={(event) => setTask({ ...task, title: event.target.value })} className={fieldClass} placeholder="What should the business team do?" /></label>
          <label className="block text-sm text-slate-300">Context<textarea maxLength={1000} rows={3} value={task.description} onChange={(event) => setTask({ ...task, description: event.target.value })} className={fieldClass} placeholder="Add a clear reason and expected outcome." /></label>
          <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm text-slate-300">Assign to<select value={task.assignedTo} onChange={(event) => setTask({ ...task, assignedTo: event.target.value })} className={fieldClass}><option value="">Business owner / unassigned</option>{selectedBusiness?.members.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.role}</option>)}</select></label><label className="block text-sm text-slate-300">Priority<select value={task.priority} onChange={(event) => setTask({ ...task, priority: event.target.value })} className={fieldClass}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label></div>
          <button type="submit" disabled={saving || !overview.businesses.length} className={buttonClass}>{saving ? "Assigning…" : "Create and notify business"}</button>
        </form>

        <form onSubmit={(event) => void submitAction(event, "suggestions", suggestion)} className="space-y-4 rounded-2xl border border-violet-300/15 bg-[radial-gradient(ellipse_at_100%_0%,rgba(124,58,237,0.09),transparent_45%),rgba(255,255,255,0.025)] p-5 sm:p-6">
          <div><p className="text-xs uppercase tracking-[0.18em] text-fuchsia-200">Business guidance</p><h2 className="mt-2 text-lg font-semibold">Send a suggestion</h2><p className="mt-1 text-xs leading-5 text-slate-500">Suggestions are attributed to platform operations, delivered to the selected business, and remain advisory.</p></div>
          <label className="block text-sm text-slate-300">Business<select required value={suggestion.organizationId} onChange={(event) => setSuggestion({ ...suggestion, organizationId: event.target.value })} className={fieldClass}><option value="">Select a business</option>{overview.businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}</select></label>
          <label className="block text-sm text-slate-300">Suggestion title<input required minLength={2} maxLength={160} value={suggestion.title} onChange={(event) => setSuggestion({ ...suggestion, title: event.target.value })} className={fieldClass} placeholder="A clear, actionable idea" /></label>
          <label className="block text-sm text-slate-300">Why it may help<textarea required minLength={2} maxLength={1000} rows={5} value={suggestion.summary} onChange={(event) => setSuggestion({ ...suggestion, summary: event.target.value })} className={fieldClass} placeholder="Share context, a practical next step, or a question for the business." /></label>
          <button type="submit" disabled={saving || !overview.businesses.length} className={buttonClass}>{saving ? "Sending…" : "Send advisory suggestion"}</button>
        </form>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
          <div className="border-b border-white/10 px-5 py-5 sm:px-6"><p className="text-xs uppercase tracking-[0.18em] text-violet-300">Business portfolio</p><h2 className="mt-2 text-lg font-semibold">Businesses in the system</h2></div>
          <div className="max-h-[480px] overflow-auto">
            {overview.businesses.map((business) => <div key={business.id} className="grid gap-3 border-b border-white/5 px-5 py-4 last:border-0 sm:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(55px,.6fr))] sm:items-center sm:px-6">
              <div className="flex min-w-0 items-center gap-3"><span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-violet-300/15 bg-violet-500/10 text-sm font-semibold text-violet-100">{business.name.slice(0, 1).toUpperCase()}</span><div className="min-w-0"><p className="truncate text-sm font-medium">{business.name}</p><p className="truncate text-xs text-slate-500">{business.industry || "Industry not set"} · Joined {formatTime(business.createdAt)}</p></div></div>
              {[["Users", business.userCount], ["Subscribers", business.subscriberCount], ["Tasks", business.taskCount], ["Complaints", business.complaintCount]].map(([label, count]) => <div key={String(label)} className="flex items-center justify-between text-xs sm:block"><span className="text-slate-500 sm:block">{String(label)}</span><strong className="sm:mt-1 sm:block">{Number(count).toLocaleString("en-NG")}</strong></div>)}
            </div>)}
            {!overview.businesses.length && <p className="px-6 py-10 text-center text-sm text-slate-500">No businesses are recorded yet.</p>}
          </div>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.18em] text-cyan-200">Illustrated activity stream</p><h2 className="mt-2 text-lg font-semibold">What’s happening across Kora</h2><p className="mt-1 text-xs text-slate-500">Recent activity grouped with its business and actor.</p></div><span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-slate-400">{overview.recentActivities.length} records</span></div>
          <div className="mt-5 max-h-[570px] space-y-2 overflow-auto">
            {overview.recentActivities.map((activity) => <article key={activity.id} className="flex gap-3 rounded-xl border border-white/5 bg-black/15 p-3 transition hover:border-violet-300/20"><ActivityIllustration type={`${activity.type} ${activity.entityType}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1"><p className="text-sm font-medium">{activity.title}</p><time className="text-[10px] text-slate-500">{formatTime(activity.createdAt)}</time></div><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{activity.summary}</p><p className="mt-2 truncate text-[10px] text-violet-200/80">{activity.organizationName} · {activity.actorName || "System"}</p></div></article>)}
            {!overview.recentActivities.length && <div className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center"><ActivityIllustration type="business" /><p className="mt-3 text-sm text-slate-400">No recorded activity is available yet.</p></div>}
          </div>
        </article>
      </section>
      <section className="rounded-2xl border border-rose-300/15 bg-rose-500/[0.025] p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.18em] text-rose-200">Support desk</p><h2 className="mt-2 text-lg font-semibold">Business complaints</h2><p className="mt-1 text-xs text-slate-500">Review and update submitted support reports; each status change notifies its submitter.</p></div><span className="rounded-full border border-rose-300/15 px-3 py-1 text-xs text-rose-100">{overview.metrics.complaints} tracked</span></div>
        {overview.metrics.complaints > overview.complaints.length && <p className="mt-3 text-xs text-slate-500">Showing the 100 most recent complaints. The metric above includes all complaint records returned by the data source.</p>}
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {overview.complaints.map((complaint) => <article key={complaint.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="flex gap-3"><ActivityIllustration type="complaint" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-medium">{complaint.title}</h3><span className="rounded-full border border-rose-300/15 px-2 py-1 text-[10px] text-rose-100">{complaint.status.replace(/_/g, " ")}</span></div><p className="mt-2 text-xs leading-5 text-slate-300">{complaint.summary}</p><p className="mt-2 text-[10px] text-slate-500">{complaint.organizationName} · {complaint.submittedBy} · {complaint.category} · {formatTime(complaint.createdAt)}</p>
              {["open", "under_review"].includes(complaint.status) && <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={saving} onClick={() => void updateComplaint(complaint, "under_review")} className="rounded-lg border border-amber-300/20 px-3 py-2 text-xs text-amber-100 disabled:opacity-50">Mark under review</button><button type="button" disabled={saving} onClick={() => void updateComplaint(complaint, "resolved")} className="rounded-lg bg-emerald-500/15 px-3 py-2 text-xs text-emerald-100 disabled:opacity-50">Resolve</button><button type="button" disabled={saving} onClick={() => void updateComplaint(complaint, "dismissed")} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 disabled:opacity-50">Dismiss</button></div>}
            </div></div>
          </article>)}
          {!overview.complaints.length && <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-500 lg:col-span-2">No business complaints have been submitted.</p>}
        </div>
      </section>
      <p className="text-center text-[11px] leading-5 text-slate-600">System activity is refreshed every 15 seconds while this page is open. Metrics represent persisted records and are not estimates; complaint counts include submitted complaint records only.</p>
    </div>
  </main>;
}
