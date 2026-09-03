"use client";

import { useState } from "react";

export default function OnboardingFlow() {
  const [currentStep, setCurrentStep] = useState<string>("business_type");
  const [progress, setProgress] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(
    "Let's get your business running.\n\nThis will only take about five minutes."
  );

  const [formData, setFormData] = useState<Record<string, unknown>>({});

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
          window.location.href = "/dashboard";
        }
      } else {
        alert("Error: " + (result.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred. Please try again.");
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

  return (
    <div className="space-y-4">
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
        onClick={() => onNext({ type: selected })}
        disabled={!selected || loading}
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

  return (
    <div className="space-y-4">
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Enter number of employees"
        className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-white placeholder:text-slate-400 focus:border-violet-500 focus:outline-none"
      />
      <button
        onClick={() => onNext({ employees: value })}
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
      <button
        onClick={() => onNext({ software: selected })}
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
      <button
        onClick={() => onNext({ challenge: selected })}
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
