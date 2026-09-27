"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function OnboardingFlow() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<string>("business_type");
  const [progress, setProgress] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(
    "Let's get your business running.\n\nThis will only take about five minutes."
  );
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetch("/api/onboarding", { cache: "no-store" }).then((response) => response.json()).then((result) => {
        if (result.profile && !result.complete) {
          setCurrentStep(result.step ?? "business_type");
          setProgress(result.progress ?? 0);
        }
      }).catch(() => setError("Could not load your saved setup. Try again."));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const businessTypes = [
    { id: "restaurant", label: "Restaurant" },
    { id: "agency", label: "Agency" },
    { id: "clinic", label: "Clinic" },
    { id: "school", label: "School" },
    { id: "retail", label: "Retail Store" },
    { id: "construction", label: "Construction" },
    { id: "manufacturer", label: "Manufacturer" },
    { id: "other", label: "Other" },
  ];

  const challenges = [
    { id: "finding_customers", label: "Finding customers" },
    { id: "following_up", label: "Following up" },
    { id: "payroll", label: "Payroll" },
    { id: "inventory", label: "Inventory" },
    { id: "cash_flow", label: "Cash flow" },
    { id: "employees", label: "Employees" },
    { id: "marketing", label: "Marketing" },
  ];

  const integrations = [
    { id: "gmail", label: "Gmail", icon: "📧" },
    { id: "whatsapp", label: "WhatsApp Business", icon: "💬" },
    { id: "bank", label: "Bank Account", icon: "🏦" },
    { id: "calendar", label: "Calendar", icon: "📅" },
    { id: "stripe", label: "Stripe", icon: "💳" },
    { id: "paystack", label: "Paystack", icon: "💰" },
    { id: "flutterwave", label: "Flutterwave", icon: "🌊" },
    { id: "shopify", label: "Shopify", icon: "🛍️" },
    { id: "woocommerce", label: "WooCommerce", icon: "🏪" },
    { id: "google_drive", label: "Google Drive", icon: "📁" },
    { id: "dropbox", label: "Dropbox", icon: "📦" },
  ];

  const software = [
    { id: "whatsapp", label: "WhatsApp" },
    { id: "excel", label: "Excel" },
    { id: "google_sheets", label: "Google Sheets" },
    { id: "quickbooks", label: "QuickBooks" },
    { id: "none", label: "None" },
  ];

  async function handleNext(stepData: Record<string, unknown>) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: currentStep,
          data: stepData,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setMessage(result.message);
        setProgress(result.progress);
        setCurrentStep(result.nextStep);

        if (result.nextStep === "complete") {
          // Onboarding complete
          router.push("/dashboard");
        }
      } else {
        setError(result.error || "Unable to save this step. Please try again.");
      }
    } catch (error) {
      console.error("Error:", error);
      setError("A network error occurred. Your answers are still here; try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#07070f] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-2xl font-semibold text-white">Setup Your Business</h2>
            <span className="text-sm text-violet-400">{progress}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2">
            <div
              className="bg-linear-to-r from-violet-500 to-violet-400 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Message */}
        <div className="mb-8 p-6 rounded-2xl border border-violet-500/20 bg-violet-500/10">
          <p className="text-lg text-slate-100 whitespace-pre-line">{message}</p>
        </div>

        {/* Step Content */}
        <div className="space-y-4">
          {currentStep === "business_type" && (
            <BusinessTypeStep
              onNext={handleNext}
              loading={loading}
              options={businessTypes}
            />
          )}

          {currentStep === "employees" && (
            <EmployeesStep onNext={handleNext} loading={loading} />
          )}

          {currentStep === "customers" && (
            <CustomersStep onNext={handleNext} loading={loading} />
          )}

          {currentStep === "software" && (
            <SoftwareStep
              onNext={handleNext}
              loading={loading}
              options={software}
            />
          )}

          {currentStep === "challenge" && (
            <ChallengeStep
              onNext={handleNext}
              loading={loading}
              options={challenges}
            />
          )}

          {currentStep === "integrations" && (
            <IntegrationsStep
              onNext={handleNext}
              loading={loading}
              options={integrations}
            />
          )}
        </div>
        {error && <p role="alert" className="mt-4 rounded-xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</p>}
      </div>
    </div>
  );
}

function BusinessTypeStep({
  onNext,
  loading,
  options,
}: {
  onNext: (data: Record<string, unknown>) => void;
  loading: boolean;
  options: Array<{ id: string; label: string }>;
}) {
  const [selected, setSelected] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("");
  const [country, setCountry] = useState("Nigeria");
  const [currency, setCurrency] = useState("NGN");
  const [timezone, setTimezone] = useState("Africa/Lagos");

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2"><input required value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="Business name" className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-violet-500" /><input required value={industry} onChange={(event) => setIndustry(event.target.value)} placeholder="Industry (e.g. consulting)" className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-violet-500" /><select value={country} onChange={(event) => { const selectedCountry = event.target.value; const defaults: Record<string, { currency: string; timezone: string }> = { Nigeria: { currency: "NGN", timezone: "Africa/Lagos" }, Ghana: { currency: "GHS", timezone: "Africa/Accra" }, Kenya: { currency: "KES", timezone: "Africa/Nairobi" }, "South Africa": { currency: "ZAR", timezone: "Africa/Johannesburg" }, Other: { currency: "USD", timezone: "UTC" } }; setCountry(selectedCountry); setCurrency(defaults[selectedCountry].currency); setTimezone(defaults[selectedCountry].timezone); }} className="rounded-xl border border-white/10 bg-[#11111c] px-4 py-3 text-white"><option>Nigeria</option><option>Ghana</option><option>Kenya</option><option>South Africa</option><option>Other</option></select><select value={currency} onChange={(event) => setCurrency(event.target.value)} className="rounded-xl border border-white/10 bg-[#11111c] px-4 py-3 text-white"><option value="NGN">NGN · Nigerian naira</option><option value="GHS">GHS · Ghanaian cedi</option><option value="KES">KES · Kenyan shilling</option><option value="ZAR">ZAR · South African rand</option><option value="USD">USD · US dollar</option></select><input value={timezone} onChange={(event) => setTimezone(event.target.value)} placeholder="Timezone (e.g. Africa/Lagos)" className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-violet-500 sm:col-span-2" /></div>
      <div className="grid grid-cols-2 gap-3">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setSelected(opt.id)}
            className={`p-4 rounded-xl border-2 transition-all duration-200 ${
              selected === opt.id
                ? "border-violet-500 bg-violet-500/20 text-white"
                : "border-white/10 bg-slate-950/50 text-slate-300 hover:border-violet-400/50"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <button
        onClick={() => onNext({ type: selected, businessName, industry, country, currency, timezone })}
        disabled={!selected || !businessName.trim() || !industry.trim() || loading}
        className="w-full px-6 py-3 bg-violet-500 text-white rounded-xl font-semibold hover:bg-violet-400 disabled:opacity-50 transition-all"
      >
        {loading ? "Continuing..." : "Next"}
      </button>
    </div>
  );
}

function EmployeesStep({
  onNext,
  loading,
}: {
  onNext: (data: Record<string, unknown>) => void;
  loading: boolean;
}) {
  const [value, setValue] = useState("");
  const [customers, setCustomers] = useState("");
  const [monthlyRevenueRange, setMonthlyRevenueRange] = useState("unknown");

  return (
    <div className="space-y-4">
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Enter number of employees"
        className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-white placeholder:text-slate-400 focus:border-violet-500 focus:outline-none"
      />
      <input type="number" min="0" value={customers} onChange={(e) => setCustomers(e.target.value)} placeholder="Approximate customers per month" className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-400 focus:border-violet-500 focus:outline-none" />
      <select value={monthlyRevenueRange} onChange={(event) => setMonthlyRevenueRange(event.target.value)} className="w-full rounded-xl border border-white/10 bg-[#11111c] px-4 py-3 text-white"><option value="unknown">Monthly revenue range (prefer not to say)</option><option value="under_500k">Under 500,000 in selected currency</option><option value="500k_2m">500,000–2,000,000</option><option value="2m_10m">2,000,000–10,000,000</option><option value="over_10m">Over 10,000,000</option></select>
      <button
        onClick={() => { onNext({ employees: value, customers: customers || "0", monthlyRevenueRange }); }}
        disabled={!value || loading}
        className="w-full px-6 py-3 bg-violet-500 text-white rounded-xl font-semibold hover:bg-violet-400 disabled:opacity-50 transition-all"
      >
        {loading ? "Continuing..." : "Next"}
      </button>
    </div>
  );
}

function CustomersStep({
  onNext,
  loading,
}: {
  onNext: (data: Record<string, unknown>) => void;
  loading: boolean;
}) {
  const [value, setValue] = useState("");

  return (
    <div className="space-y-4">
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Average customers per month"
        className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-white placeholder:text-slate-400 focus:border-violet-500 focus:outline-none"
      />
      <button
        onClick={() => onNext({ customers: value })}
        disabled={!value || loading}
        className="w-full px-6 py-3 bg-violet-500 text-white rounded-xl font-semibold hover:bg-violet-400 disabled:opacity-50 transition-all"
      >
        {loading ? "Continuing..." : "Next"}
      </button>
    </div>
  );
}

function SoftwareStep({
  onNext,
  loading,
  options,
}: {
  onNext: (data: Record<string, unknown>) => void;
  loading: boolean;
  options: Array<{ id: string; label: string }>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [offerings, setOfferings] = useState("");

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => toggle(opt.id)}
            className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
              selected.includes(opt.id)
                ? "border-violet-500 bg-violet-500/20 text-white"
                : "border-white/10 bg-slate-950/50 text-slate-300 hover:border-violet-400/50"
            }`}
          >
            {selected.includes(opt.id) ? "✓ " : "  "}{opt.label}
          </button>
        ))}
      </div>
      <label className="block text-sm text-slate-300">What products or services do you offer?<input value={offerings} onChange={(event) => setOfferings(event.target.value)} placeholder="Separate a few examples with commas" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-violet-500" /></label>
      <button
        onClick={() => onNext({ software: selected, offerings })}
        disabled={selected.length === 0 || loading}
        className="w-full px-6 py-3 bg-violet-500 text-white rounded-xl font-semibold hover:bg-violet-400 disabled:opacity-50 transition-all"
      >
        {loading ? "Continuing..." : "Next"}
      </button>
    </div>
  );
}

function ChallengeStep({
  onNext,
  loading,
  options,
}: {
  onNext: (data: Record<string, unknown>) => void;
  loading: boolean;
  options: Array<{ id: string; label: string }>;
}) {
  const [selected, setSelected] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [channels, setChannels] = useState<string[]>([]);
  const [payments, setPayments] = useState<string[]>([]);
  const [hours, setHours] = useState("Weekdays, 9am–5pm");
  const [reports, setReports] = useState<string[]>(["weekly_summary"]);
  const toggle = (values: string[], set: (next: string[]) => void, value: string) => set(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setSelected(opt.id)}
            className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
              selected === opt.id
                ? "border-violet-500 bg-violet-500/20 text-white"
                : "border-white/10 bg-slate-950/50 text-slate-300 hover:border-violet-400/50"
            }`}
          >
            {selected === opt.id ? "✓ " : "  "}{opt.label}
          </button>
        ))}
      </div>
      <fieldset className="rounded-xl border border-white/10 p-4"><legend className="px-2 text-sm text-slate-300">What would you most like to achieve?</legend><div className="grid grid-cols-2 gap-2">{["grow_revenue", "win_customers", "improve_cash_flow", "deliver_projects", "organize_team", "save_time"].map((goal) => <label key={goal} className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={goals.includes(goal)} onChange={() => toggle(goals, setGoals, goal)} />{goal.replaceAll("_", " ")}</label>)}</div></fieldset>
      <div className="grid gap-3 sm:grid-cols-2"><fieldset className="rounded-xl border border-white/10 p-4"><legend className="px-2 text-xs text-slate-300">Preferred channels</legend>{["email", "phone", "whatsapp"].map((item) => <label key={item} className="mr-3 inline-flex items-center gap-1 text-xs text-slate-400"><input type="checkbox" checked={channels.includes(item)} onChange={() => toggle(channels, setChannels, item)} />{item}</label>)}</fieldset><fieldset className="rounded-xl border border-white/10 p-4"><legend className="px-2 text-xs text-slate-300">Payment methods</legend>{["bank_transfer", "card", "cash", "mobile_money"].map((item) => <label key={item} className="mr-3 inline-flex items-center gap-1 text-xs text-slate-400"><input type="checkbox" checked={payments.includes(item)} onChange={() => toggle(payments, setPayments, item)} />{item.replace("_", " ")}</label>)}</fieldset></div>
      <input value={hours} onChange={(event) => setHours(event.target.value)} placeholder="Business working hours" className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-violet-500" />
      <fieldset className="rounded-xl border border-white/10 p-4"><legend className="px-2 text-xs text-slate-300">Reports to prepare</legend>{["weekly_summary", "monthly_finance", "project_status"].map((item) => <label key={item} className="mr-4 inline-flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={reports.includes(item)} onChange={() => toggle(reports, setReports, item)} />{item.replaceAll("_", " ")}</label>)}</fieldset>
      <button
        onClick={() => onNext({ challenge: selected, goals, communicationChannels: channels, preferredPaymentMethods: payments, workingHours: hours, reportingPreferences: reports })}
        disabled={!selected || loading}
        className="w-full px-6 py-3 bg-violet-500 text-white rounded-xl font-semibold hover:bg-violet-400 disabled:opacity-50 transition-all"
      >
        {loading ? "Continuing..." : "Next"}
      </button>
    </div>
  );
}

function IntegrationsStep({
  onNext,
  loading,
  options,
}: {
  onNext: (data: Record<string, unknown>) => void;
  loading: boolean;
  options: Array<{ id: string; label: string; icon: string }>;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => toggle(opt.id)}
            className={`p-4 rounded-xl border-2 transition-all ${
              selected.includes(opt.id)
                ? "border-violet-500 bg-violet-500/20"
                : "border-white/10 bg-slate-950/50 hover:border-violet-400/50"
            }`}
          >
            <div className="text-2xl mb-2">{opt.icon}</div>
            <div className="text-xs text-slate-300">{opt.label}</div>
          </button>
        ))}
      </div>
      <button
        onClick={() => onNext({ integrations: selected })}
        disabled={loading}
        className="w-full px-6 py-3 bg-violet-500 text-white rounded-xl font-semibold hover:bg-violet-400 disabled:opacity-50 transition-all"
      >
        {loading ? "Setting up..." : "Complete Setup"}
      </button>
    </div>
  );
}
