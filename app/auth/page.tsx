"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const oauthErrors: Record<string, string> = {
  oauth_not_configured: "That sign-in option is not configured yet. Use your email and password or try again later.",
  google_auth: "Google sign-in could not be completed. Please try again.",
  facebook_auth: "Facebook sign-in could not be completed. Please try again.",
  apple_auth: "Apple sign-in could not be completed. Please try again.",
};

const socialProviders = [
  { name: "Google", href: "/api/auth/google", mark: "G", style: "hover:border-blue-300/60" },
  { name: "Facebook", href: "/api/auth/facebook", mark: "f", style: "hover:border-blue-400/60" },
  { name: "Apple", href: "/api/auth/apple", mark: "A", style: "hover:border-white/45" },
];

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">(() =>
    searchParams.get("mode") === "signup" ? "signup" : "signin"
  );
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [status, setStatus] = useState(() => oauthErrors[searchParams.get("error") ?? ""] ?? "");
  const [enabledProviders, setEnabledProviders] = useState<string[]>([]);
  const [providerError, setProviderError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadProviders() {
      try {
        const response = await fetch("/api/auth/providers", { cache: "no-store" });
        if (!response.ok) throw new Error("Unable to load sign-in options.");
        const result: unknown = await response.json();
        if (!result || typeof result !== "object" || !("providers" in result) || !Array.isArray(result.providers)) {
          throw new Error("The sign-in options response was invalid.");
        }
        if (active) setEnabledProviders(result.providers.filter((provider): provider is string => typeof provider === "string"));
      } catch (error) {
        console.error("Unable to load social sign-in options.", error);
        if (active) setProviderError("Additional sign-in options could not be loaded. Email sign-in is still available.");
      }
    }

    void loadProviders();
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "signup" && form.password !== form.confirmPassword) {
      setStatus("Passwords do not match.");
      return;
    }

    setBusy(true);
    setStatus("");
    try {
      const response = await fetch(mode === "signup" ? "/api/auth/signup" : "/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "signup"
          ? form
          : { email: form.email, password: form.password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Authentication failed.");
      if (result.needsVerification) {
        if (result.developmentVerificationUrl) router.push(result.developmentVerificationUrl);
        else {
          setMode("signin");
          setStatus(result.message);
        }
        return;
      }
      router.push(mode === "signup" ? "/onboarding" : "/dashboard");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050509] px-5 py-10 text-white">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-10 flex items-center gap-3">
          <span className="logo-mark">K</span>
          <span>
            <span className="block text-[0.62rem] uppercase tracking-[0.3em] text-violet-200/70">Business OS</span>
            <span className="text-lg font-semibold">Kora</span>
          </span>
        </Link>
        <div className="border border-white/10 bg-[#101019] p-6 shadow-2xl sm:p-8">
          <div className="mb-8">
            <p className="text-[0.68rem] uppercase tracking-[0.24em] text-violet-300">Your operating picture</p>
            <h1 className="mt-3 text-3xl font-semibold">{mode === "signup" ? "Create your workspace" : "Welcome back"}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              {mode === "signup" ? "Start with the context your business already has." : "Continue to the business you are already building."}
            </p>
          </div>
          <div className="mb-6 grid grid-cols-2 border-b border-white/10">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`border-b-2 px-3 pb-3 text-sm ${mode === "signin" ? "border-violet-400 text-white" : "border-transparent text-slate-500"}`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`border-b-2 px-3 pb-3 text-sm ${mode === "signup" ? "border-violet-400 text-white" : "border-transparent text-slate-500"}`}
            >
              Sign up
            </button>
          </div>
          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <input
                required
                minLength={2}
                autoComplete="name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Full name"
                className="w-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-violet-400"
              />
            )}
            <input
              required
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="Work email"
              className="w-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-violet-400"
            />
            <input
              required
              minLength={8}
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder="Password"
              className="w-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-violet-400"
            />
            {mode === "signup" && (
              <input
                required
                minLength={8}
                type="password"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
                placeholder="Confirm password"
                className="w-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-violet-400"
              />
            )}
            <button
              disabled={busy}
              className="w-full bg-violet-500 px-4 py-3 text-sm font-semibold transition hover:bg-violet-400 disabled:opacity-50"
            >
              {busy ? "Working..." : mode === "signup" ? "Create workspace" : "Continue to dashboard"}
            </button>
          </form>
          {mode === "signin" && (
            <Link href="/auth/reset" className="mt-4 inline-block text-sm text-violet-200 transition hover:text-white">
              Forgot your password?
            </Link>
          )}
          {enabledProviders.length > 0 && (
            <>
              <div className="my-5 flex items-center gap-3 text-xs text-slate-500 before:h-px before:flex-1 before:bg-white/10 after:h-px after:flex-1 after:bg-white/10">
                or continue with
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {socialProviders.filter((provider) => enabledProviders.includes(provider.name)).map((provider) => (
                  <a
                    key={provider.name}
                    href={provider.href}
                    className={`flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-3 text-sm font-semibold text-white transition hover:bg-white/5 ${provider.style}`}
                  >
                    <span aria-hidden="true" className="font-bold">{provider.mark}</span>
                    <span>{provider.name}</span>
                  </a>
                ))}
              </div>
            </>
          )}
          {providerError && <p role="alert" className="mt-4 text-sm text-fuchsia-100">{providerError}</p>}
          {status && (
            <p role="alert" aria-live="polite" className="mt-4 border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-2 text-sm text-fuchsia-100">
              {status}
            </p>
          )}
          <p className="mt-6 text-center text-xs text-slate-500">Your data stays scoped to your workspace.</p>
        </div>
      </div>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<main className="grid min-h-screen place-items-center bg-[#050509] text-slate-400">Loading account access…</main>}>
      <AuthForm />
    </Suspense>
  );
}
