"use client";

import { useEffect, useState } from "react";

const navItems = ["Overview", "Pipeline", "Customers", "Invoices", "Automation", "Team"];

type WorkspaceData = {
  user: { name: string; email: string; role: string; organizationId?: string | null };
  organization?: { name: string; industry: string; timezone: string; currency: string } | null;
  onboarding?: { businessName?: string; industry?: string; goals?: string[]; tools?: string[]; challenges?: string[] } | null;
};

export default function DashboardPage() {
  const [user, setUser] = useState<{ name: string; email: string; role: string; organizationId?: string | null } | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);

  useEffect(() => {
    const loadWorkspace = async () => {
      try {
        const response = await fetch("/api/workspace", { cache: "no-store" });
        if (!response.ok) {
          window.location.href = "/";
          return;
        }

        const data = (await response.json()) as WorkspaceData;
        setWorkspace(data);
        setUser(data.user);
      } catch {
        window.location.href = "/";
      }
    };

    void loadWorkspace();
  }, []);

  if (!user) {
    return <div className="min-h-screen bg-[#07070f] text-white">Loading workspace...</div>;
  }

  return (
    <div className="min-h-screen bg-[#07070f] text-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="logo-mark">K</div>
              <div>
                <p className="text-[0.6rem] uppercase tracking-[0.3em] text-violet-200/80">Business OS</p>
                <h1 className="text-lg font-semibold text-white">Kora</h1>
              </div>
            </div>

            <nav className="flex flex-wrap items-center gap-2">
              {navItems.map((item) => (
                <button key={item} type="button" className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-violet-400/60 hover:bg-violet-500/10">
                  {item}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[0.65rem] font-medium text-emerald-300">
                Live workspace
              </div>
              <button
                type="button"
                onClick={() => {
                  window.localStorage.removeItem("kora-session");
                  window.location.href = "/";
                }}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-100"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        <main className="grid gap-6 xl:grid-cols-[1.5fr_0.75fr]">
          <section className="rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.24),transparent_28%),rgba(12,10,22,0.9)] p-6 sm:p-8">
            <p className="text-[0.68rem] uppercase tracking-[0.24em] text-violet-300/80">Daily command center</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-5xl">{user.name.split(" ")[0]}'s workspace</h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
              Intelligent insights from your business operations, real-time analytics, and AI-powered recommendations to help you make better decisions faster.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {[
                { label: "Revenue tracked", value: "₦12.4M" },
                { label: "Open tasks", value: "27" },
                { label: "AI insights", value: "14" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <p className="text-[0.66rem] uppercase tracking-[0.18em] text-slate-400">{stat.label}</p>
                  <p className="mt-4 text-2xl font-semibold text-white">{stat.value}</p>
                </div>
              ))}
            </div>
          </section>

          <aside className="rounded-[30px] border border-white/10 bg-slate-950/60 p-5">
            <p className="text-[0.65rem] uppercase tracking-[0.22em] text-slate-400">Profile</p>
            <div className="mt-4 rounded-2xl border border-violet-500/25 bg-violet-500/10 p-4">
              <p className="text-xl font-semibold text-white">{user.name}</p>
              <p className="mt-2 text-sm text-slate-200">{user.email}</p>
              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-violet-200">{user.role}</p>
              <p className="mt-3 text-xs text-slate-300">{workspace?.organization?.name ?? "Workspace"} • {workspace?.organization?.industry ?? "Business"}</p>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
