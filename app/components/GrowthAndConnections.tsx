"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";

type LeadRequest = {
  id: string;
  title: string;
  createdAt: string;
  data: { packageLabel?: string; fulfillmentStatus?: string; paymentStatus?: string; requestedMonthlyVolume?: number; targeting?: { country?: string; region?: string } };
};

type IntegrationState = { connected: boolean; requestedAt: string | null; capability: string; oauthConfigured?: boolean; message: string };

const fieldClass = "mt-1 w-full rounded-xl border border-white/10 bg-[#0b0b14] px-3 py-2.5 text-sm text-white outline-none transition focus:border-violet-300/50";
const buttonClass = "rounded-xl border border-violet-300/30 bg-violet-500/10 px-4 py-2.5 text-sm font-medium text-violet-100 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50";
const splitValues = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
const browserAlertsChanged = "kora-browser-alerts-change";
const subscribeToBrowserAlerts = (notify: () => void) => {
  window.addEventListener("storage", notify);
  window.addEventListener(browserAlertsChanged, notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(browserAlertsChanged, notify);
  };
};
const getBrowserAlertsSnapshot = () => "Notification" in window &&
  Notification.permission === "granted" &&
  window.localStorage.getItem("kora-browser-alerts") === "enabled";

export function GrowthAndConnections({ canManage }: { canManage: boolean }) {
  const [tab, setTab] = useState<"leads" | "connections">("leads");
  const [requests, setRequests] = useState<LeadRequest[]>([]);
  const [whatsapp, setWhatsapp] = useState<IntegrationState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([
      fetch("/api/lead-service", { cache: "no-store" }).then(async (response) => ({ ok: response.ok, result: await response.json() })),
      fetch("/api/integrations", { cache: "no-store" }).then(async (response) => ({ ok: response.ok, result: await response.json() })),
    ]).then(([leadResult, integrationResult]) => {
      if (!active) return;
      if (leadResult.ok && Array.isArray(leadResult.result.data)) setRequests(leadResult.result.data);
      if (integrationResult.ok) setWhatsapp(integrationResult.result.data?.whatsapp ?? null);
    }).catch(() => {
      if (active) setError("Growth and connection details could not be loaded. Refresh this page to try again.");
    });
    return () => { active = false; };
  }, []);

  async function requestLeadReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;
    setBusy(true); setError(""); setNotice("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const body = {
      package: form.get("package"),
      country: form.get("country"),
      region: form.get("region") || undefined,
      jobTitles: splitValues(String(form.get("jobTitles") ?? "")),
      industries: splitValues(String(form.get("industries") ?? "")),
      companySize: form.get("companySize"),
      ageMin: form.get("ageMin") ? Number(form.get("ageMin")) : undefined,
      ageMax: form.get("ageMax") ? Number(form.get("ageMax")) : undefined,
      interests: splitValues(String(form.get("interests") ?? "")),
      acceptsReviewTerms: form.get("acceptsReviewTerms") === "on",
    };
    try {
      const response = await fetch("/api/lead-service", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "The lead-service review could not be requested.");
      setRequests((current) => [result.data, ...current]);
      formElement.reset();
      setNotice("Your request is saved for review. No subscription, payment, or lead delivery has started.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The lead-service review could not be requested.");
    } finally {
      setBusy(false);
    }
  }

  async function requestWhatsApp() {
    if (!canManage || !confirmed) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/integrations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: "whatsapp", businessAccountConfirmed: true }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "The connection request could not be saved.");
      setWhatsapp((current) => current ? { ...current, requestedAt: result.data.requestedAt, connected: result.data.connected } : current);
      setNotice(result.data.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The connection request could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function connectWhatsApp() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/integrations/whatsapp/connect", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "WhatsApp connection is not configured.");
      window.location.assign(result.url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "WhatsApp connection is not configured."); setBusy(false); }
  }

  async function requestSubscription(plan: "pilot" | "steady" | "scale") {
    if (!canManage) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/lead-service/subscription", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan, acceptsTerms: true }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "The subscription request could not be saved.");
      setNotice(result.message ?? "Subscription request saved.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The subscription request could not be saved."); }
    finally { setBusy(false); }
  }

  return <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-6">
      <div><p className="text-xs uppercase tracking-[0.18em] text-violet-300">Growth and connections</p><h2 className="mt-2 text-xl font-semibold">Bring the next opportunity into view</h2><p className="mt-1 text-sm text-slate-400">Request a targeted lead-service review or check your business messaging connection.</p></div>
      <div className="flex gap-2" role="tablist" aria-label="Growth options">
        <button type="button" role="tab" aria-selected={tab === "leads"} onClick={() => setTab("leads")} className={`rounded-lg px-3 py-2 text-sm transition ${tab === "leads" ? "bg-violet-500/20 text-violet-100" : "text-slate-400 hover:text-white"}`}>Lead service</button>
        <button type="button" role="tab" aria-selected={tab === "connections"} onClick={() => setTab("connections")} className={`rounded-lg px-3 py-2 text-sm transition ${tab === "connections" ? "bg-violet-500/20 text-violet-100" : "text-slate-400 hover:text-white"}`}>Connections</button>
      </div>
    </div>
    <div className="p-5 sm:p-6">
      {error && <p role="alert" className="mb-4 rounded-xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p>}
      {notice && <p role="status" className="mb-4 rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{notice}</p>}
      {tab === "leads" ? <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <form onSubmit={(event) => void requestLeadReview(event)} className="space-y-4">
          <div><h3 className="font-medium">Describe the audience you want to reach</h3><p className="mt-1 text-sm text-slate-400">A team member will need to review availability, lawful sourcing, delivery and pricing before anything is offered.</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-slate-300">Review option<select name="package" defaultValue="pilot" className={fieldClass}><option value="pilot">Pilot · request up to 25 prospects monthly</option><option value="steady">Steady growth · request up to 100 monthly</option><option value="scale">Scale · request up to 250 monthly</option></select></label>
            <label className="text-sm text-slate-300">Country<input name="country" required minLength={2} maxLength={80} placeholder="For example, Ghana" className={fieldClass} /></label>
            <label className="text-sm text-slate-300">State, region or city<input name="region" maxLength={100} placeholder="Optional" className={fieldClass} /></label>
            <label className="text-sm text-slate-300">Company size<select name="companySize" defaultValue="any" className={fieldClass}><option value="any">Any size</option><option value="1-10">1–10 people</option><option value="11-50">11–50 people</option><option value="51-200">51–200 people</option><option value="201+">201+ people</option></select></label>
            <label className="text-sm text-slate-300 sm:col-span-2">Job titles, separated by commas<input name="jobTitles" required placeholder="For example, Operations Manager, Founder" className={fieldClass} /></label>
            <label className="text-sm text-slate-300 sm:col-span-2">Industries<input name="industries" placeholder="For example, hospitality, retail" className={fieldClass} /></label>
            <label className="text-sm text-slate-300">Adult age range, optional<input name="ageMin" type="number" min="18" max="100" placeholder="Minimum age" className={fieldClass} /></label>
            <label className="text-sm text-slate-300"> <input name="ageMax" type="number" min="18" max="100" placeholder="Maximum age" className={fieldClass} /></label>
            <label className="text-sm text-slate-300 sm:col-span-2">Relevant professional interests<input name="interests" placeholder="For example, inventory management, online sales" className={fieldClass} /></label>
          </div>
          <label className="flex items-start gap-3 text-xs leading-5 text-slate-400"><input name="acceptsReviewTerms" type="checkbox" required className="mt-1 accent-violet-400" /><span>I understand this only requests a review. Kora does not currently source or deliver leads through this form, and there is no charge or active subscription. Any future offer must explain its source, price, terms and opt-out process before I agree.</span></label>
          <button type="submit" disabled={!canManage || busy} className={buttonClass}>{busy ? "Saving request…" : canManage ? "Request availability review" : "Ask a workspace owner to request a review"}</button>
          <p className="text-xs leading-5 text-slate-500">We do not support targeting based on sensitive personal traits such as health, religion, race or political views. Only adult professional audiences are eligible for review.</p>
          <div className="grid gap-2 sm:grid-cols-3"><button type="button" disabled={!canManage || busy} onClick={() => void requestSubscription("pilot")} className={buttonClass}>Request Pilot subscription</button><button type="button" disabled={!canManage || busy} onClick={() => void requestSubscription("steady")} className={buttonClass}>Request Steady subscription</button><button type="button" disabled={!canManage || busy} onClick={() => void requestSubscription("scale")} className={buttonClass}>Request Scale subscription</button></div>
        </form>
        <aside className="rounded-xl border border-white/10 bg-black/20 p-4 sm:p-5">
          <h3 className="font-medium">Your review requests</h3>
          <p className="mt-1 text-sm leading-5 text-slate-400">A saved request is not a subscription. Nothing is charged or delivered while supplier, pricing and checkout arrangements are unavailable.</p>
          {requests.length ? <ul className="mt-4 space-y-3">{requests.map((item) => <li key={item.id} className="rounded-lg border border-white/10 px-3 py-3"><p className="text-sm font-medium">{item.data.packageLabel ?? item.title}</p><p className="mt-1 text-xs text-slate-400">{item.data.targeting?.country}{item.data.targeting?.region ? ` · ${item.data.targeting.region}` : ""} · up to {item.data.requestedMonthlyVolume} requested monthly</p><p className="mt-2 text-xs text-amber-200">Availability review needed · no payment or delivery started</p></li>)}</ul> : <p className="mt-4 rounded-lg border border-dashed border-white/10 p-4 text-sm text-slate-500">No review requests yet.</p>}
        </aside>
      </div> : <div className="grid gap-5 md:grid-cols-[1fr_0.8fr]">
        <div><div className="flex items-center gap-3"><span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${whatsapp?.connected ? "bg-emerald-400" : "bg-amber-300"}`} /><h3 className="font-medium">WhatsApp Business</h3><span className="rounded-full border border-amber-300/20 px-2.5 py-1 text-xs text-amber-100">{whatsapp?.connected ? "Connected" : whatsapp?.requestedAt ? "Request recorded" : "Not connected"}</span></div>
          <p className="mt-3 text-sm leading-6 text-slate-400">{whatsapp?.message ?? "Checking connection status…"}</p>
          {whatsapp?.requestedAt && <p className="mt-2 text-xs text-slate-500">Request recorded {new Date(whatsapp.requestedAt).toLocaleDateString()}.</p>}
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm font-medium">Connection is not available yet</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">A real connection needs Meta Business authorization, secure token storage and customer opt-in controls. Until those are configured, Kora will not read conversations or send messages.</p>
          {canManage && !whatsapp?.requestedAt && <label className="mt-4 flex items-start gap-3 text-xs leading-5 text-slate-400"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 accent-violet-400" /><span>I am authorized to request setup for this workspace’s WhatsApp Business account.</span></label>}
          {canManage && whatsapp?.oauthConfigured && <button type="button" disabled={busy} onClick={() => void connectWhatsApp()} className={`${buttonClass} mt-3`}>{busy ? "Opening Meta…" : "Connect WhatsApp Business"}</button>}
          {canManage && !whatsapp?.oauthConfigured && !whatsapp?.requestedAt && <button type="button" disabled={!confirmed || busy} onClick={() => void requestWhatsApp()} className={`${buttonClass} mt-3`}>{busy ? "Recording request…" : "Record setup request"}</button>}
          {whatsapp?.requestedAt && <p className="mt-3 text-xs text-slate-400">No customer has been contacted. Customer consent and message approval will be required before any future outreach.</p>}
        </div>
      </div>}
    </div>
  </section>;
}

export function BrowserActivityAlerts({ activity }: { activity: Array<{ id: string; type: string; createdAt: string }> }) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [open, setOpen] = useState(false);
  const enabled = useSyncExternalStore(subscribeToBrowserAlerts, getBrowserAlertsSnapshot, () => false);
  const lastSeen = useRef("");

  useEffect(() => {
    if (!enabled || !activity.length) return;
    const latest = activity[0];
    if (!lastSeen.current) { lastSeen.current = latest.id; return; }
    if (latest.id === lastSeen.current) return;
    const unseen = activity.find((event) => event.id !== lastSeen.current);
    lastSeen.current = latest.id;
    if (!unseen || Notification.permission !== "granted") return;
    const readable = unseen.type.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
    new Notification("A workspace update is ready", { body: `A new ${readable.toLowerCase()} was recorded in your workspace.`, tag: unseen.id });
  }, [activity, enabled]);

  async function toggleAlerts() {
    if (!("Notification" in window)) { setPermission("unsupported"); return; }
    if (enabled) {
      window.localStorage.removeItem("kora-browser-alerts");
      window.dispatchEvent(new Event(browserAlertsChanged));
      return;
    }
    const next = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    setPermission(next);
    if (next === "granted") {
      window.localStorage.setItem("kora-browser-alerts", "enabled");
      lastSeen.current = activity[0]?.id ?? "";
      window.dispatchEvent(new Event(browserAlertsChanged));
    }
  }

  return <div className="relative">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={`Workspace activity, ${activity.length} recent updates`} className="rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-300 transition hover:border-violet-300/40 hover:text-white">Updates <span className="ml-1 rounded-full bg-violet-500/20 px-2 py-0.5 text-xs">{activity.length}</span></button>
    {open && <div className="absolute right-0 top-full z-20 mt-2 w-[min(22rem,90vw)] rounded-xl border border-white/10 bg-[#11111c] p-4 shadow-2xl">
      <div className="flex items-start justify-between gap-3"><div><p className="font-medium">Workspace updates</p><p className="mt-1 text-xs leading-5 text-slate-400">{enabled ? "Browser alerts are on while this dashboard is open." : "Turn on browser alerts to hear about new activity while this dashboard is open."}</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Close updates" className="text-lg leading-none text-slate-400">×</button></div>
      <button type="button" onClick={() => void toggleAlerts()} disabled={permission === "unsupported" || permission === "denied"} className={`${buttonClass} mt-3 w-full`}>{permission === "unsupported" ? "Browser alerts are not supported" : permission === "denied" ? "Allow alerts in browser settings" : enabled ? "Turn off browser alerts" : "Turn on browser alerts"}</button>
      <ul className="mt-4 max-h-56 space-y-2 overflow-auto">{activity.slice(0, 5).map((event) => <li key={event.id} className="rounded-lg border border-white/5 bg-white/[0.025] px-3 py-2"><p className="text-sm">{event.type.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())}</p><p className="mt-1 text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</p></li>)}</ul>
    </div>}
  </div>;
}
