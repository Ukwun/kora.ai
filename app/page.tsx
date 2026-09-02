"use client";

import { useEffect, useMemo, useState } from "react";

type UserAccount = {
  id: string;
  name: string;
  email: string;
  role: string;
  organizationId?: string | null;
};

type AuthMode = "signin" | "signup";

type ActionEvent = {
  id: number;
  label: string;
  detail: string;
  time: string;
  value?: number;
};

type MemoryNode = {
  id: string;
  label: string;
  count: number;
  detail: string;
};

type Insight = {
  id: number;
  title: string;
  summary: string;
  intensity: "High" | "Medium" | "Low";
};

type SearchItem = {
  id: string;
  kind: "Customer" | "Lead" | "Invoice" | "Quotation" | "Project" | "Task" | "Employee" | "Expense" | "Product";
  title: string;
  meta: string;
};

const navItems = ["Overview", "Pipeline", "Customers", "Invoices", "Automation", "Team"];

const koraFeatures = [
  "Passive learning from every sale, invoice, and task",
  "Business memory that remembers patterns and exceptions",
  "Behavior-aware AI recommendations grounded in real activity",
  "Role-aware workspace visibility and decision support",
];

const featureMetrics = [
  { value: "4.8x", label: "Faster weekly reporting" },
  { value: "3.2x", label: "More completed actions" },
  { value: "24/7", label: "Operational visibility" },
];

const starterEvents: ActionEvent[] = [
  { id: 1, label: "Invoice paid", detail: "INV-1043 • Nneka Studio", time: "12m ago", value: 420000 },
  { id: 2, label: "Lead captured", detail: "BrightPath Media • Paid social campaign", time: "41m ago" },
  { id: 3, label: "Approval queued", detail: "Quarterly growth budget review", time: "1h ago" },
  { id: 4, label: "Employee check-in", detail: "Oluchi completed the reporting sprint", time: "2h ago" },
];

const starterMemory: MemoryNode[] = [
  { id: "customers", label: "Customers", count: 184, detail: "Strong retention and recurring value." },
  { id: "products", label: "Products", count: 26, detail: "Top sellers are densely concentrated in two categories." },
  { id: "invoices", label: "Invoices", count: 146, detail: "Late payments cluster in the same client segment." },
  { id: "employees", label: "Employees", count: 14, detail: "Productivity spikes during the second half of the week." },
  { id: "tasks", label: "Tasks", count: 93, detail: "Follow-up tasks are delayed most often by sales approvals." },
];

const starterInsights: Insight[] = [
  {
    id: 1,
    title: "Follow-up opportunity",
    summary: "14 quotations were sent this month. 9 did not receive a follow-up within the expected window.",
    intensity: "High",
  },
  {
    id: 2,
    title: "Inventory cadence",
    summary: "Coffee beans generally sell out every 28 days, so replenishment should be triggered earlier than usual.",
    intensity: "Medium",
  },
  {
    id: 3,
    title: "Late-payment pattern",
    summary: "Late payments cluster around the last 5 days before month close and are most common with recurring retainer clients.",
    intensity: "High",
  },
];

const searchCatalog: SearchItem[] = [
  { id: "c-1", kind: "Customer", title: "Nneka Studio", meta: "Retainer • Active last 4 days" },
  { id: "l-1", kind: "Lead", title: "BrightPath Media", meta: "Qualified • Follow-up due today" },
  { id: "i-1", kind: "Invoice", title: "INV-1043", meta: "₦420,000 • Due 3 days ago" },
  { id: "q-1", kind: "Quotation", title: "Q-2209", meta: "Website refresh • ₦860,000" },
  { id: "p-1", kind: "Project", title: "Alpha Launch", meta: "Marketing sprint • 74% complete" },
  { id: "t-1", kind: "Task", title: "Review vendor contract", meta: "Finance • Due today" },
  { id: "e-1", kind: "Employee", title: "Oluchi Adeyemi", meta: "Operations manager • 92% on-time rate" },
  { id: "x-1", kind: "Expense", title: "Paid ads spend", meta: "Marketing • ₦180,000 this week" },
  { id: "pr-1", kind: "Product", title: "Brand refresh package", meta: "Service • Most requested" },
];

export default function Home() {
  const [showIntro, setShowIntro] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [session, setSession] = useState<UserAccount | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState<MemoryNode>(starterMemory[0]);
  const [events, setEvents] = useState<ActionEvent[]>(starterEvents);
  const [memoryNodes, setMemoryNodes] = useState<MemoryNode[]>(starterMemory);
  const [insights, setInsights] = useState<Insight[]>(starterInsights);
  const [revenue, setRevenue] = useState(12400000);
  const [dailyCheckIn, setDailyCheckIn] = useState("Nothing significant.");
  const [dailyCheckInOpen, setDailyCheckInOpen] = useState(false);
  const [customers, setCustomers] = useState(184);
  const [workflowCount, setWorkflowCount] = useState(184);
  const [retention, setRetention] = useState(91);
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "demo@kora.ng",
    password: "demo1234",
    confirmPassword: "",
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setShowIntro(false), 1200);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const savedSession = window.localStorage.getItem("kora-session");
    if (savedSession) {
      setSession(JSON.parse(savedSession));
    } else {
      void fetchSession();
    }
  }, []);

  const summaryTitle = useMemo(
    () => (session ? `${session.name.split(" ")[0]}'s workspace` : "The operating system for modern businesses"),
    [session]
  );

  const suggestedResults = useMemo(() => {
    if (!searchQuery.trim()) {
      return searchCatalog.slice(0, 4);
    }

    const value = searchQuery.toLowerCase();
    return searchCatalog.filter((item) => {
      return item.title.toLowerCase().includes(value) || item.kind.toLowerCase().includes(value) || item.meta.toLowerCase().includes(value);
    });
  }, [searchQuery]);

  const fetchSession = async () => {
    try {
      const response = await fetch("/api/auth/session");
      if (!response.ok) return;
      const data = await response.json();
      if (data?.user) {
        setSession(data.user);
        window.localStorage.setItem("kora-session", JSON.stringify(data.user));
      }
    } catch {
      // UI stays in guest mode when session is unavailable.
    }
  };

  const persistSession = (user: UserAccount) => {
    setSession(user);
    window.localStorage.setItem("kora-session", JSON.stringify(user));
  };

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const addActivity = (label: string, detail: string, value?: number) => {
    const nextEvent: ActionEvent = {
      id: Date.now(),
      label,
      detail,
      time: "just now",
      value,
    };

    setEvents((current) => [nextEvent, ...current].slice(0, 5));

    if (value) {
      setRevenue((current) => current + value);
    }
  };

  const updateMemory = (label: string, delta: number, detail: string) => {
    setMemoryNodes((current) =>
      current.map((node) =>
        node.label === label ? { ...node, count: Math.max(node.count + delta, 0), detail } : node
      )
    );

    const activeNode = memoryNodes.find((node) => node.label === label);
    if (activeNode) {
      setSelectedMemory({ ...activeNode, count: Math.max(activeNode.count + delta, 0), detail });
    }
  };

  const pushInsight = (title: string, summary: string, intensity: Insight["intensity"]) => {
    setInsights((current) => [{ id: Date.now(), title, summary, intensity }, ...current].slice(0, 4));
  };

  const handleDailyCheckIn = (answer: string) => {
    setDailyCheckIn(answer);
    setDailyCheckInOpen(false);
    addActivity("Daily check-in", `Owner noted: ${answer}`, 0);

    const followUp =
      answer === "Nothing significant."
        ? "The operating memory remains steady and there are no urgent exceptions to escalate."
        : `The team has a new operating signal: ${answer}. Kora will incorporate this into the next recommendation set.`;

    pushInsight("Trust loop update", followUp, "Medium");
    setMemoryNodes((current) =>
      current.map((node) =>
        node.label === "Customers"
          ? { ...node, detail: "Customer memory is being refreshed from the latest operating signal." }
          : node
      )
    );
  };

  const handleAction = (kind: string, detail: string, amount?: number) => {
    addActivity(kind, detail, amount);

    if (kind === "Invoice") {
      updateMemory("Invoices", 1, "Late payments are clustered around month-end follow-up delays.");
      setWorkflowCount((value) => value + 6);
      pushInsight("Payment rhythm", `${detail} was captured and the workflow now expects quicker settlement timing from this client segment.`, "Medium");
      return;
    }

    if (kind === "Customer") {
      setCustomers((value) => value + 1);
      updateMemory("Customers", 1, "Customer expansion is strongest in retainer and recurring service accounts.");
      pushInsight("Growth signal", `A new customer was added and relationship strength is trending upward in ${detail.split("•")[1] || "your active accounts"}.`, "Low");
      return;
    }

    if (kind === "Product") {
      updateMemory("Products", 1, "Best-selling items are now tied to repeat purchases and supplier timing.");
      pushInsight("Product demand", `Product tracking shows stronger demand in ${detail}.`, "Medium");
      return;
    }

    if (kind === "Task") {
      updateMemory("Tasks", 1, "Approval bottlenecks continue to delay cross-functional task completion.");
      pushInsight("Execution drag", "Task completion is slowing at the approval layer, especially on finance reviews.", "High");
      return;
    }

    if (kind === "Appointment") {
      pushInsight("Client engagement", `A customer appointment was scheduled and is likely to improve conversion with a personal follow-up.`, "Medium");
      return;
    }

    if (kind === "Payment") {
      setRetention((value) => Math.min(99, value + 1));
      pushInsight("Cashflow health", "Incoming payment behavior is improving after the owner’s new reminder cadence.", "Medium");
      return;
    }

    if (kind === "Expense") {
      pushInsight("Expense review", "Recent expense spikes are concentrated in marketing and travel and deserve a weekly trim cycle.", "Low");
      return;
    }

    if (kind === "Employee") {
      updateMemory("Employees", 1, "Top-performing employees remain concentrated in recurring delivery and customer communication roles.");
      pushInsight("Capacity pattern", "The most productive team segments align with service delivery and account follow-up loops.", "Medium");
      return;
    }

    pushInsight("Operational learning", `${kind} activity has been added to the memory graph and will inform future recommendations.`, "Low");
  };

  const handleSocialAuth = async (provider: "google" | "facebook") => {
    setBusy(true);
    setStatus("Connecting your workspace...");

    try {
      const response = await fetch(`/api/auth/${provider}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name || "Kora User",
          email: form.email || `${provider}.user@kora.ng`,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Social sign-in failed");
      }

      persistSession(result.user as UserAccount);
      setStatus(`${provider === "google" ? "Google" : "Facebook"} connected successfully.`);
      setIsOnboardingOpen(true);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Social auth failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPassword = async () => {
    setBusy(true);
    setStatus("Sending a reset link to your inbox...");

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Password reset failed");
      }

      setStatus(`Reset link sent to ${result.account.email}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Password reset failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setStatus(authMode === "signup" ? "Creating your workspace..." : "Signing you in...");

    try {
      const endpoint = authMode === "signup" ? "/api/auth/signup" : "/api/auth/signin";
      const payload =
        authMode === "signup"
          ? {
              name: form.name,
              email: form.email,
              password: form.password,
              confirmPassword: form.confirmPassword,
            }
          : { email: form.email, password: form.password };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Authentication failed");
      }

      const user = (result.user || {
        id: "demo-user",
        name: form.name || "Kora User",
        email: form.email,
        role: "owner",
        organizationId: "org_kora_1",
      }) as UserAccount;

      persistSession(user);
      setStatus(authMode === "signup" ? "Workspace created successfully." : "Welcome back.");
      setIsOnboardingOpen(authMode === "signup");
      if (authMode !== "signup") {
        window.location.href = "/dashboard";
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  };

  const completeOnboarding = async () => {
    try {
      setBusy(true);
      setStatus("Configuring your workspace and first tasks...");

      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: form.name || "Kora Business",
          industry: "Operations & Services",
          goals: ["Create a daily AI briefing", "Track customer activity", "Bring invoices and tasks into one place"],
          tools: ["Gmail", "WhatsApp", "Stripe", "Google Drive"],
          challenges: ["Follow-up delays", "Unclear revenue signals", "Task visibility"],
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Workspace setup failed");
      }

      setStatus("Workspace configured. Your first operational summary is ready.");
      setIsOnboardingOpen(false);
      window.location.href = "/dashboard";
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Workspace setup failed.");
    } finally {
      setBusy(false);
    }
  };

  const logout = () => {
    window.localStorage.removeItem("kora-session");
    setSession(null);
    setStatus("Signed out successfully.");
  };

  if (session) {
    return (
      <div className="min-h-screen bg-[#07070f] text-slate-50">
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-5 sm:px-6 lg:px-8">
          <header className="sticky top-4 z-40 mb-6 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-xl">
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
                  <button 
                    key={item} 
                    type="button" 
                    onClick={() => {}}
                    className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-violet-400/60 hover:bg-violet-500/10 cursor-pointer"
                  >
                    {item}
                  </button>
                ))}
              </nav>

              <div className="relative w-full max-w-md">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search customers, invoices, tasks..."
                  className="w-full rounded-full border border-white/10 bg-slate-950/50 px-3.5 py-2 text-sm text-white placeholder:text-slate-400 focus:border-violet-400/80 focus:outline-none"
                />
                {searchQuery && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-violet-500/20 bg-[#0f0d1d] shadow-[0_20px_60px_rgba(76,29,149,0.35)]">
                    {suggestedResults.length > 0 ? (
                      suggestedResults.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="flex w-full items-center justify-between gap-3 border-b border-white/5 px-3 py-2.5 text-left last:border-b-0 hover:bg-violet-500/10"
                        >
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-violet-200">{item.kind}</p>
                            <p className="mt-1 text-sm font-medium text-white">{item.title}</p>
                          </div>
                          <span className="text-right text-xs text-slate-400">{item.meta}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-3 text-sm text-slate-300">No matching records found.</div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[0.65rem] font-medium text-emerald-300">
                  Live workspace
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-100"
                >
                  Sign out
                </button>
              </div>
            </div>
          </header>

          <main className="space-y-6">
            <section className="rounded-[30px] border border-violet-500/20 bg-[#120d1f]/80 p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[0.68rem] uppercase tracking-[0.24em] text-violet-200/80">Daily check-in</p>
                  <h3 className="mt-2 text-xl font-semibold text-white">Good morning, {session.name.split(" ")[0]}.</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setDailyCheckInOpen(true)}
                  className="rounded-full bg-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(168,85,247,0.35)] transition hover:bg-violet-400"
                >
                  Update context
                </button>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Before we start, did anything important happen yesterday?</p>
                <p className="mt-3 text-base text-slate-100">{dailyCheckIn}</p>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.6fr_0.8fr]">
              <div className="rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.22),transparent_30%),rgba(12,10,22,0.9)] p-6 shadow-[0_30px_80px_rgba(76,29,149,0.25)] sm:p-8">
                <p className="text-[0.68rem] uppercase tracking-[0.24em] text-violet-300/80">Daily command center</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-5xl">{summaryTitle}</h2>
                <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
                  Kora learns from every invoice, customer, task, payment, and appointment so the next decision is based on actual business behavior, not isolated guesses.
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => handleAction("Invoice", "New invoice created for Oluchi & Co • 3D design retainer", 480000)} className="rounded-full bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_14px_40px_rgba(168,85,247,0.4)] transition hover:bg-violet-400">
                    + New invoice
                  </button>
                  <button type="button" onClick={() => handleAction("Appointment", "Client meeting scheduled with Northwind Build", 0)} className="rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-slate-100 transition hover:border-violet-400/50 hover:bg-violet-500/10">
                    Review AI brief
                  </button>
                </div>

                <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                    <p className="text-[0.66rem] uppercase tracking-[0.18em] text-slate-400">Revenue tracked</p>
                    <div className="mt-4 flex items-end justify-between">
                      <span className="text-2xl font-semibold text-white">₦{(revenue / 1000000).toFixed(1)}M</span>
                      <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[0.62rem] font-medium text-emerald-300">+18.4%</span>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                    <p className="text-[0.66rem] uppercase tracking-[0.18em] text-slate-400">Active customers</p>
                    <div className="mt-4 flex items-end justify-between">
                      <span className="text-2xl font-semibold text-white">{customers}</span>
                      <span className="rounded-full bg-violet-500/15 px-2 py-1 text-[0.62rem] font-medium text-violet-300">+6</span>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                    <p className="text-[0.66rem] uppercase tracking-[0.18em] text-slate-400">Tasks automated</p>
                    <div className="mt-4 flex items-end justify-between">
                      <span className="text-2xl font-semibold text-white">{workflowCount}</span>
                      <span className="rounded-full bg-cyan-500/15 px-2 py-1 text-[0.62rem] font-medium text-cyan-300">+41%</span>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                    <p className="text-[0.66rem] uppercase tracking-[0.18em] text-slate-400">Retention</p>
                    <div className="mt-4 flex items-end justify-between">
                      <span className="text-2xl font-semibold text-white">{retention}%</span>
                      <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[0.62rem] font-medium text-emerald-300">+5.6%</span>
                    </div>
                  </div>
                </div>
              </div>

              <aside className="rounded-[30px] border border-white/10 bg-slate-950/60 p-5">
                <p className="text-[0.65rem] uppercase tracking-[0.22em] text-slate-400">Business memory</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">{selectedMemory.label}</h3>
                <div className="mt-4 rounded-2xl border border-violet-500/25 bg-violet-500/10 p-4">
                  <p className="text-3xl font-semibold text-white">{selectedMemory.count}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">{selectedMemory.detail}</p>
                </div>

                <div className="mt-5 space-y-2">
                  {memoryNodes.map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => setSelectedMemory(node)}
                      className={`flex w-full items-center justify-between rounded-2xl border px-3 py-2.5 text-left text-sm transition ${selectedMemory.id === node.id ? "border-violet-400/60 bg-violet-500/10" : "border-white/10 bg-white/5"}`}
                    >
                      <span className="text-slate-200">{node.label}</span>
                      <span className="font-semibold text-white">{node.count}</span>
                    </button>
                  ))}
                </div>
              </aside>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[30px] border border-white/10 bg-slate-950/60 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[0.65rem] uppercase tracking-[0.22em] text-slate-400">Passive learning</p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">Action stream</h3>
                  </div>
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[0.65rem] font-medium text-emerald-300">Live</span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { label: "Invoice", icon: "▣", description: "Create invoice and log value" },
                    { label: "Customer", icon: "◉", description: "Add new customer memory" },
                    { label: "Product", icon: "◌", description: "Track inventory and demand" },
                    { label: "Task", icon: "✦", description: "Log approval and workflow delay" },
                    { label: "Appointment", icon: "◎", description: "Schedule a client touchpoint" },
                    { label: "Payment", icon: "▤", description: "Record incoming capital" },
                  ].map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      onClick={() =>
                        handleAction(
                          action.label,
                          `${action.description} was added to the active operating graph.`,
                          action.label === "Invoice" ? 480000 : action.label === "Payment" ? 120000 : 0
                        )
                      }
                      className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-violet-400/60 hover:bg-violet-500/10"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-lg text-violet-200">{action.icon}</span>
                        <span className="text-[0.6rem] uppercase tracking-[0.18em] text-slate-400">learn</span>
                      </div>
                      <p className="mt-3 text-base font-semibold text-white">{action.label}</p>
                      <p className="mt-1 text-sm text-slate-300">{action.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[30px] border border-white/10 bg-slate-950/60 p-5">
                <p className="text-[0.65rem] uppercase tracking-[0.22em] text-slate-400">Recent activity</p>
                <div className="mt-4 space-y-3">
                  {events.map((event) => (
                    <div key={event.id} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="mt-1 h-2.5 w-2.5 rounded-full bg-violet-400 shadow-[0_0_20px_rgba(168,85,247,0.8)]" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white">{event.label}</p>
                        <p className="mt-1 text-xs text-slate-400">{event.detail}</p>
                      </div>
                      <span className="text-[0.7rem] text-slate-500">{event.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
              <div className="rounded-[30px] border border-white/10 bg-slate-950/60 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[0.65rem] uppercase tracking-[0.22em] text-slate-400">Behavior modeling</p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">AI observations</h3>
                  </div>
                  <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[0.65rem] font-medium text-violet-200">Grounded in activity</span>
                </div>

                <div className="space-y-3">
                  {insights.map((insight) => (
                    <div key={insight.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-base font-semibold text-white">{insight.title}</p>
                        <span className={`rounded-full px-2 py-1 text-[0.6rem] font-medium ${insight.intensity === "High" ? "bg-rose-500/15 text-rose-300" : insight.intensity === "Medium" ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300"}`}>
                          {insight.intensity}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{insight.summary}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[30px] border border-white/10 bg-slate-950/60 p-5">
                <p className="text-[0.65rem] uppercase tracking-[0.22em] text-slate-400">Business memory graph</p>
                <div className="mt-4 space-y-4">
                  {[
                    "Business profile",
                    "Employees",
                    "Customers",
                    "Products",
                    "Invoices",
                    "Expenses",
                    "Projects",
                    "Meetings",
                  ].map((item, idx) => (
                    <div key={item} className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/10 text-[0.7rem] font-medium text-violet-200">{idx + 1}</div>
                      <div className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">{item}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07070f] text-slate-100">
      {showIntro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#07070f]">
          <div className="intro-bg-orb intro-bg-orb-one" />
          <div className="intro-bg-orb intro-bg-orb-two" />
          <div className="intro-shell">
            <div className="intro-logo-wrap">
              <div className="logo-orb">K</div>
              <div className="logo-ring" />
            </div>
            <div className="intro-text-wrap">
              <p className="intro-kicker">KORA</p>
              <p className="intro-title">Operating system</p>
              <div className="intro-progress">
                <span />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="logo-mark">K</div>
            <div>
              <p className="text-[0.62rem] uppercase tracking-[0.3em] text-violet-200/80">Business OS</p>
              <h1 className="text-lg font-semibold text-white">Kora</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button type="button" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 hover:border-violet-400/60">
              Book demo
            </button>
            <button
              type="button"
              onClick={() => setAuthMode("signin")}
              className="rounded-full bg-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(168,85,247,0.35)] hover:bg-violet-400"
            >
              Sign in
            </button>
          </div>
        </header>

        <main className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.28),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.18),transparent_24%),rgba(11,10,21,0.94)] p-6 sm:p-8 lg:p-10">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.03),transparent_45%,rgba(168,85,247,0.06))]" />

            <div className="relative">
              <div className="inline-flex items-center rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-[0.68rem] uppercase tracking-[0.22em] text-violet-200">
                Trusted by operators
              </div>

              <h2 className="mt-6 max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                The operating system for businesses that need clarity, speed, and traction.
              </h2>

              <p className="mt-6 max-w-xl text-base leading-8 text-slate-300 sm:text-lg">
                Kora centralizes sales, customer memory, money movement, operations, and AI-guided next steps so your team always wins the next moment.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setAuthMode("signup")}
                  className="rounded-full bg-violet-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(168,85,247,0.35)] hover:bg-violet-400"
                >
                  Start free
                </button>
                <button type="button" className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-slate-100 hover:border-violet-400/60 hover:bg-violet-500/10">
                  Watch product tour
                </button>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {featureMetrics.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 backdrop-blur-sm">
                    <p className="text-2xl font-semibold text-white">{item.value}</p>
                    <p className="mt-1 text-sm text-slate-300">{item.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {[
                  { title: "Daily context", text: "The app asks for the signal that matters before work begins." },
                  { title: "Trust loop", text: "Every action teaches the AI something about the business." },
                  { title: "Proactive guidance", text: "Kora surfaces the next best move instead of waiting for prompts." },
                ].map((item) => (
                  <div key={item.title} className="rounded-2xl border border-violet-500/20 bg-white/5 p-4 backdrop-blur-sm">
                    <p className="text-xs uppercase tracking-[0.2em] text-violet-200">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">{item.text}</p>
                  </div>
                ))}
              </div>

              <div className="mt-10 rounded-[30px] border border-white/10 bg-slate-950/50 p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-[0.66rem] uppercase tracking-[0.22em] text-slate-400">Subscription model</p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">Built for growth</h3>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  {[
                    { name: "Starter", price: "₦14,000", detail: "One workspace • 3 users • basic AI", accent: "border-violet-500/40" },
                    { name: "Growth", price: "₦34,000", detail: "Advanced reports • automation • team roles", accent: "border-violet-400/60 bg-violet-500/10" },
                    { name: "Business", price: "₦79,000", detail: "Custom onboarding • full permissions • priority support", accent: "border-emerald-500/40" },
                  ].map((plan) => (
                    <div key={plan.name} className={`rounded-3xl border bg-slate-950/40 p-5 ${plan.accent}`}>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{plan.name}</p>
                      <p className="mt-4 text-3xl font-semibold text-white">{plan.price}<span className="text-sm text-slate-400">/mo</span></p>
                      <p className="mt-3 text-sm leading-6 text-slate-300">{plan.detail}</p>
                      <button type="button" className="mt-5 w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-violet-400/60 hover:bg-violet-500/10">
                        Choose plan
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <aside className="rounded-4xl border border-white/10 bg-slate-950/80 p-5 shadow-[0_20px_60px_rgba(109,40,217,0.18)] backdrop-blur-xl sm:p-6">
            <div className="mb-5 flex items-center rounded-full border border-violet-500/20 bg-violet-500/10 p-1 text-sm">
              <button
                type="button"
                onClick={() => setAuthMode("signin")}
                className={`flex-1 rounded-full px-3 py-2 font-medium transition ${authMode === "signin" ? "bg-white text-slate-950" : "text-slate-300"}`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("signup")}
                className={`flex-1 rounded-full px-3 py-2 font-medium transition ${authMode === "signup" ? "bg-white text-slate-950" : "text-slate-300"}`}
              >
                Create account
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {authMode === "signup" && (
                <div>
                  <label className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-slate-400">Full name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) => handleChange("name", event.target.value)}
                    placeholder="Jane Doe"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-3.5 py-3 text-sm text-white outline-none transition focus:border-violet-400"
                  />
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-slate-400">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => handleChange("email", event.target.value)}
                  placeholder="you@company.com"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-3.5 py-3 text-sm text-white outline-none transition focus:border-violet-400"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-slate-400">Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => handleChange("password", event.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-3.5 py-3 text-sm text-white outline-none transition focus:border-violet-400"
                  required
                />
              </div>

              {authMode === "signup" && (
                <div>
                  <label className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-slate-400">Confirm password</label>
                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={(event) => handleChange("confirmPassword", event.target.value)}
                    placeholder="Repeat password"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-3.5 py-3 text-sm text-white outline-none transition focus:border-violet-400"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-2xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_35px_rgba(168,85,247,0.35)] transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {busy ? "Please wait..." : authMode === "signin" ? "Continue to dashboard" : "Create workspace"}
              </button>
            </form>

            <div className="mt-4 flex items-center gap-3 text-slate-400">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-[0.68rem] uppercase tracking-[0.2em]">or continue with</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void handleSocialAuth("google")}
                disabled={busy}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-medium text-slate-100 hover:border-violet-400/50"
              >
                Google
              </button>
              <button
                type="button"
                onClick={() => void handleSocialAuth("facebook")}
                disabled={busy}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-medium text-slate-100 hover:border-violet-400/50"
              >
                Facebook
              </button>
            </div>

            <button
              type="button"
              onClick={() => void handleForgotPassword()}
              className="mt-4 w-full text-center text-sm font-medium text-violet-200 hover:text-violet-100"
            >
              Forgot password?
            </button>

            {status && <p className="mt-4 rounded-2xl border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-sm text-violet-100">{status}</p>}

            <div className="mt-6 rounded-[26px] border border-white/10 bg-white/5 p-4">
              <p className="text-[0.65rem] uppercase tracking-[0.22em] text-slate-400">Why teams choose Kora</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                {koraFeatures.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </main>
      </div>

      {dailyCheckInOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[30px] border border-white/10 bg-[#120d1f] p-6 shadow-[0_30px_80px_rgba(111,76,255,0.35)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[0.66rem] uppercase tracking-[0.22em] text-violet-200/80">Daily check-in</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">Good morning.</h3>
              </div>
              <button type="button" onClick={() => setDailyCheckInOpen(false)} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-slate-200">
                Close
              </button>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-300">
              Before we start, did anything important happen yesterday?
            </p>

            <div className="mt-5 grid gap-3">
              {[
                "We hired someone.",
                "A customer canceled.",
                "We launched a new product.",
                "We received a large payment.",
                "We changed prices.",
                "Nothing significant.",
              ].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleDailyCheckIn(option)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-medium text-slate-100 transition hover:border-violet-400/60 hover:bg-violet-500/10"
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {isOnboardingOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[30px] border border-white/10 bg-[#0f0d1d] p-6 shadow-[0_30px_80px_rgba(96,61,185,0.35)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[0.66rem] uppercase tracking-[0.22em] text-violet-200/80">Onboarding</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">Welcome to Kora</h3>
              </div>
              <button type="button" onClick={() => setIsOnboardingOpen(false)} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-slate-200">
                Close
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-medium text-white">Your workspace is ready</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  The next step is to add your business profile, connect your tools, and let Kora begin learning your workflow.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-medium text-slate-100">Connect Stripe</button>
                <button type="button" className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-medium text-slate-100">Connect Gmail</button>
                <button type="button" className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-medium text-slate-100">Link WhatsApp</button>
                <button type="button" className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-medium text-slate-100">Import leads</button>
              </div>

              <button
                type="button"
                onClick={() => void completeOnboarding()}
                disabled={busy}
                className="w-full rounded-2xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {busy ? "Configuring workspace..." : "Continue to workspace"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
