"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface BusinessProfile {
  onboardingStep: string;
  onboardingComplete: boolean;
  type: string;
  employees: number;
  customersPerMonth: number;
  mainChallenge: string;
  integrations: Array<{ type: string; connected: boolean }>;
  memoryNodes: Array<{ title: string; content: string }>;
}

function calculateHealth(profile: BusinessProfile): number {
  let score = 50;
  if (profile.onboardingComplete) score += 10;
  score += Math.min(20, (profile.employees || 0) / 10);
  const connectedIntegrations = profile.integrations?.filter((integration) => integration.connected).length || 0;
  score += Math.min(20, connectedIntegrations * 5);
  return Math.min(100, score);
}

export default function DashboardPage() {
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [tenant, setTenant] = useState<{
    organizationId: string;
    plan: string;
    billing: { monthlyPrice: number; seats: number; status: string; nextBillingDate: string };
    memberships: Array<{ id: string; userId: string; role: string; status: string }>;
    integrations: Array<{ type: string; connected: boolean; connectedAt?: string }>; 
  } | null>(null);
  const [health, setHealth] = useState(0);
  const [activity, setActivity] = useState<Array<{ id: string; type: string; createdAt: string; payload: Record<string, unknown> }>>([]);
  const [action, setAction] = useState<"customer" | "task" | "invoice" | null>(null);
  const [form, setForm] = useState({ name: "", email: "", title: "", number: "", amount: "" });
  const [actionStatus, setActionStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const loadWorkspace = async () => {
      try {
        // Get workspace data
        const workspaceResponse = await fetch("/api/workspace", { cache: "no-store" });
        if (!workspaceResponse.ok) {
          router.push("/");
          return;
        }

        const workspaceData = await workspaceResponse.json();
        setUser(workspaceData.user);

        // Get business profile
        const profileResponse = await fetch("/api/onboarding");
        const profileData = await profileResponse.json();

        const tenantResponse = await fetch("/api/tenant", { cache: "no-store" });
        const tenantData = tenantResponse.ok ? await tenantResponse.json() : null;
        const activityResponse = await fetch("/api/activity", { cache: "no-store" });
        const activityData = activityResponse.ok ? await activityResponse.json() : null;

        // If onboarding not complete, redirect
        if (!profileData.complete && !profileData.profile?.onboardingComplete) {
          router.push("/onboarding");
          return;
        }

        setProfile(profileData.profile);
        setTenant(tenantData?.data ?? tenantData ?? null);
        setActivity(activityData?.data ?? []);
        setHealth(calculateHealth(profileData.profile));
      } catch (error) {
        console.error("Error loading workspace:", error);
        router.push("/");
      } finally {
        setLoading(false);
      }
    };

    loadWorkspace();
  }, [router]);

  const openAction = (nextAction: "customer" | "task" | "invoice") => {
    setAction(nextAction);
    setActionStatus("");
    setForm({ name: "", email: "", title: "", number: "", amount: "" });
  };

  const submitAction = async () => {
    if (!action) return;
    setSaving(true);
    setActionStatus("");
    const endpoint = action === "customer" ? "/api/customers" : action === "task" ? "/api/tasks" : "/api/invoices";
    const body = action === "customer"
      ? { name: form.name, email: form.email }
      : action === "task"
        ? { title: form.title, priority: "medium" }
        : { number: form.number, amount: form.amount };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save this record.");
      const activityResponse = await fetch("/api/activity", { cache: "no-store" });
      const activityData = activityResponse.ok ? await activityResponse.json() : null;
      setActivity(activityData?.data ?? []);
      setActionStatus(`${action[0].toUpperCase()}${action.slice(1)} created successfully.`);
      setForm({ name: "", email: "", title: "", number: "", amount: "" });
    } catch (error) {
      setActionStatus(error instanceof Error ? error.message : "Unable to save this record.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07070f] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500 mb-4" />
          <p className="text-slate-300">Loading your business...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-[#07070f] flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-300 mb-4">Unable to load profile</p>
          <button
            onClick={() => router.push("/onboarding")}
            className="px-4 py-2 bg-violet-500 text-white rounded-lg hover:bg-violet-400"
          >
            Start Onboarding
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07070f] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-linear-to-b from-violet-500/5 to-transparent">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
              <p className="text-slate-400">Welcome to your Business Operating System</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-violet-400">{health}%</div>
              <div className="text-sm text-slate-400">Business Health</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Business Profile Overview */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl border border-violet-500/20 bg-violet-500/5 hover:border-violet-500/40 transition-all">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <span>📊</span> Your Business Profile
            </h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <span className="text-slate-400">Business Type</span>
                <span className="text-white font-semibold capitalize">{profile.type}</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <span className="text-slate-400">Team Size</span>
                <span className="text-white font-semibold">{profile.employees} {profile.employees === 1 ? "person" : "people"}</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <span className="text-slate-400">Monthly Customers</span>
                <span className="text-white font-semibold">{profile.customersPerMonth}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Main Challenge</span>
                <span className="text-white font-semibold capitalize">{profile.mainChallenge.replace(/_/g, " ")}</span>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-2xl border border-violet-500/20 bg-violet-500/5 hover:border-violet-500/40 transition-all">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <span>🏢</span> Workspace & Plan
            </h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <span className="text-slate-400">Plan</span>
                <span className="text-white font-semibold capitalize">{tenant?.plan ?? "Growth"}</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <span className="text-slate-400">Seats</span>
                <span className="text-white font-semibold">{tenant?.billing?.seats ?? 12}</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <span className="text-slate-400">Monthly spend</span>
                <span className="text-white font-semibold">₦{(tenant?.billing?.monthlyPrice ?? 34000).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Org ID</span>
                <span className="text-white font-semibold text-xs">{tenant?.organizationId ?? "org_kora_1"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl border border-violet-500/20 bg-violet-500/5 hover:border-violet-500/40 transition-all">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <span>👥</span> Team Access
            </h2>
            <div className="space-y-2">
              {(tenant?.memberships ?? []).length > 0 ? (
                tenant?.memberships.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-950/50 border border-white/5">
                    <span className="text-slate-300 capitalize">{member.role}</span>
                    <span className={`text-xs font-semibold ${member.status === "active" ? "text-green-400" : "text-amber-300"}`}>
                      {member.status}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-slate-400 text-sm">No team members assigned yet.</p>
              )}
            </div>
          </div>

          {/* Integrations & Learning */}
          <div className="p-6 rounded-2xl border border-violet-500/20 bg-violet-500/5 hover:border-violet-500/40 transition-all">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <span>🔗</span> Connected Tools
            </h2>
            <div className="space-y-2">
              {(tenant?.integrations ?? profile.integrations ?? []).length > 0 ? (
                (tenant?.integrations ?? profile.integrations).map((integration, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-950/50 border border-white/5">
                    <span className="text-slate-300 capitalize">{integration.type.replace("_", " ")}</span>
                    <span className={`text-xs font-semibold ${integration.connected ? "text-green-400" : "text-slate-500"}`}>
                      {integration.connected ? "✓ Connected" : "Not connected"}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-slate-400 text-sm">No integrations yet. Connect your tools to get started.</p>
              )}
            </div>
          </div>
        </div>

        {/* AI Insights */}
        <div className="p-6 rounded-2xl border border-violet-500/20 bg-violet-500/5">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <span>✨</span> AI Insights
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-slate-950/50 border border-white/5 hover:border-violet-400/30 transition-all cursor-pointer group">
              <div className="text-2xl mb-2">🎯</div>
              <p className="text-sm text-slate-300 group-hover:text-violet-300 transition-colors">
                Your profile is ready. I&apos;m learning about your business operations.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-slate-950/50 border border-white/5 hover:border-violet-400/30 transition-all cursor-pointer group">
              <div className="text-2xl mb-2">📈</div>
              <p className="text-sm text-slate-300 group-hover:text-violet-300 transition-colors">
                Connect your email, calendar, and payment tools for real-time insights.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-slate-950/50 border border-white/5 hover:border-violet-400/30 transition-all cursor-pointer group">
              <div className="text-2xl mb-2">📊</div>
              <p className="text-sm text-slate-300 group-hover:text-violet-300 transition-colors">
                Every invoice, customer, and task you create teaches me about your business.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-4 gap-4">
          {[
            { label: "Invoice", icon: "📄", desc: "Create invoice", action: () => openAction("invoice") },
            { label: "Customer", icon: "👥", desc: "Add customer", action: () => openAction("customer") },
            { label: "Task", icon: "✓", desc: "Create task", action: () => openAction("task") },
            { label: "Connect", icon: "🔗", desc: "Link tools", action: () => router.push("/onboarding") },
          ].map((action, i) => (
            <button
              key={i}
              type="button"
              onClick={action.action}
              className="p-4 rounded-xl border border-white/10 bg-slate-950/50 hover:bg-slate-900/70 hover:border-violet-400/40 transition-all group cursor-pointer"
            >
              <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">{action.icon}</div>
              <div className="text-sm font-medium text-slate-200 group-hover:text-violet-300 transition-colors">
                {action.label}
              </div>
              <div className="text-xs text-slate-400 mt-1">{action.desc}</div>
            </button>
          ))}
        </div>

        {activity.length > 0 && (
          <div className="p-6 rounded-2xl border border-violet-500/20 bg-violet-500/5">
            <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
            <div className="space-y-2">
              {activity.slice(0, 6).map((event) => (
                <div key={event.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-slate-950/50 px-3 py-2 text-sm">
                  <span className="text-slate-200">{event.type.replace(".", " ")}</span>
                  <span className="text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Business Memory Activity */}
        <div className="p-6 rounded-2xl border border-violet-500/20 bg-violet-500/5">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <span>🧠</span> Business Memory
          </h2>
          {profile.memoryNodes && profile.memoryNodes.length > 0 ? (
            <div className="space-y-3">
              {profile.memoryNodes.map((node, i) => (
                <div key={i} className="p-3 rounded-lg bg-slate-950/50 border border-white/5 hover:border-violet-400/30 transition-all">
                  <p className="text-sm font-medium text-slate-200">{node.title}</p>
                  <p className="text-xs text-slate-400 mt-1">{node.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <p className="mb-2">📚 No memory yet</p>
              <p className="text-sm">Start creating invoices, customers, and tasks. I&apos;ll build your business memory automatically.</p>
            </div>
          )}
        </div>
      </div>

      {action && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-violet-500/30 bg-[#101019] p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Create {action}</h2>
              <button type="button" onClick={() => setAction(null)} className="text-slate-400 hover:text-white" aria-label="Close">x</button>
            </div>
            <div className="space-y-3">
              {action === "customer" && <>
                <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Customer name" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-white" />
                <input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Email (optional)" type="email" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-white" />
              </>}
              {action === "task" && <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Task title" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-white" />}
              {action === "invoice" && <>
                <input value={form.number} onChange={(event) => setForm({ ...form, number: event.target.value })} placeholder="Invoice number" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-white" />
                <input value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="Amount in NGN" type="number" min="1" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-white" />
              </>}
              {actionStatus && <p className="text-sm text-violet-200">{actionStatus}</p>}
              <button type="button" disabled={saving} onClick={submitAction} className="w-full rounded-lg bg-violet-500 px-4 py-3 font-semibold text-white transition hover:bg-violet-400 disabled:opacity-50">{saving ? "Saving..." : `Create ${action}`}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
