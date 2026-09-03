"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMode(new URLSearchParams(window.location.search).get("mode") === "signup" ? "signup" : "signin");
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "signup" && form.password !== form.confirmPassword) { setStatus("Passwords do not match."); return; }
    setBusy(true); setStatus("");
    try {
      const response = await fetch(mode === "signup" ? "/api/auth/signup" : "/api/auth/signin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(mode === "signup" ? form : { email: form.email, password: form.password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Authentication failed.");
      router.push(mode === "signup" ? "/onboarding" : "/dashboard");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Authentication failed."); } finally { setBusy(false); }
  }

  return <main className="flex min-h-screen items-center justify-center bg-[#050509] px-5 py-10 text-white"><div className="w-full max-w-md"><a href="/" className="mb-10 flex items-center gap-3"><span className="logo-mark">K</span><span><span className="block text-[0.62rem] uppercase tracking-[0.3em] text-violet-200/70">Business OS</span><span className="text-lg font-semibold">Kora</span></span></a><div className="border border-white/10 bg-[#101019] p-6 shadow-2xl sm:p-8"><div className="mb-8"><p className="text-[0.68rem] uppercase tracking-[0.24em] text-violet-300">Your operating picture</p><h1 className="mt-3 text-3xl font-semibold">{mode === "signup" ? "Create your workspace" : "Welcome back"}</h1><p className="mt-3 text-sm leading-6 text-slate-400">{mode === "signup" ? "Start with the context your business already has." : "Continue to the business you are already building."}</p></div><div className="mb-6 grid grid-cols-2 border-b border-white/10"><button type="button" onClick={() => setMode("signin")} className={`border-b-2 px-3 pb-3 text-sm ${mode === "signin" ? "border-violet-400 text-white" : "border-transparent text-slate-500"}`}>Sign in</button><button type="button" onClick={() => setMode("signup")} className={`border-b-2 px-3 pb-3 text-sm ${mode === "signup" ? "border-violet-400 text-white" : "border-transparent text-slate-500"}`}>Sign up</button></div><form onSubmit={submit} className="space-y-4">{mode === "signup" && <input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" className="w-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:border-violet-400" />}<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Work email" className="w-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:border-violet-400" /><input required minLength={8} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Password" className="w-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:border-violet-400" />{mode === "signup" && <input required minLength={8} type="password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} placeholder="Confirm password" className="w-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:border-violet-400" />}<button disabled={busy} className="w-full bg-violet-500 px-4 py-3 text-sm font-semibold transition hover:bg-violet-400 disabled:opacity-50">{busy ? "Working..." : mode === "signup" ? "Create workspace" : "Continue to dashboard"}</button></form>{status && <p className="mt-4 border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-2 text-sm text-fuchsia-100">{status}</p>}<p className="mt-6 text-center text-xs text-slate-500">Your data stays scoped to your workspace.</p></div></div></main>;
}
