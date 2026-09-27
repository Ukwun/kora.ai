"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";

function ResetForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(token ? { token, password } : { email }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to process this request.");
      setStatus(body.developmentResetToken ? `Email delivery is not configured. Development reset token: ${body.developmentResetToken}` : body.message || "Password updated.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to process this request."); }
    finally { setBusy(false); }
  }
  return <main className="flex min-h-screen items-center justify-center bg-[#050509] px-5 py-10 text-white"><section className="w-full max-w-md border border-white/10 bg-[#101019] p-6 sm:p-8"><Link href="/" className="logo-mark">K</Link><p className="mt-8 text-xs uppercase tracking-[0.2em] text-violet-300">Account recovery</p><h1 className="mt-2 text-3xl font-semibold">{token ? "Choose a new password" : "Reset your password"}</h1><p className="mt-3 text-sm leading-6 text-slate-400">{token ? "Your reset link expires after 30 minutes." : "We’ll send a secure reset link if this email belongs to an account."}</p><form onSubmit={submit} className="mt-6 space-y-4">{token ? <input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="New password (at least 8 characters)" className="w-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none focus:border-violet-400" /> : <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Work email" className="w-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none focus:border-violet-400" />}<button disabled={busy} className="w-full bg-violet-500 px-4 py-3 text-sm font-semibold transition hover:bg-violet-400 disabled:opacity-50">{busy ? "Please wait…" : token ? "Update password" : "Send reset link"}</button></form>{status && <p role="status" className="mt-4 break-all border border-violet-400/20 bg-violet-500/10 p-3 text-sm text-violet-100">{status}</p>}<Link href="/auth" className="mt-6 inline-block text-sm text-slate-400 transition hover:text-white">Return to sign in</Link></section></main>;
}

export default function PasswordResetPage() {
  return <Suspense fallback={<main className="grid min-h-screen place-items-center bg-[#050509] text-slate-400">Loading recovery…</main>}><ResetForm /></Suspense>;
}
