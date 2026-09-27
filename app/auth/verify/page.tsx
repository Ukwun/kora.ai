"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function VerificationStatus() {
  const search = useSearchParams();
  const token = search.get("token");
  const [status, setStatus] = useState(() => token ? "Verifying your email…" : "This verification link is missing its token.");
  useEffect(() => {
    if (!token) return;
    let active = true;
    void fetch("/api/auth/verify-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Verification failed.");
      if (active) setStatus(body.message);
    }).catch((error) => { if (active) setStatus(error instanceof Error ? error.message : "Verification failed."); });
    return () => { active = false; };
  }, [token]);
  return <main className="grid min-h-screen place-items-center bg-[#050509] px-5 text-white"><section className="w-full max-w-md border border-white/10 bg-[#101019] p-7 text-center"><span className="logo-mark mx-auto">K</span><h1 className="mt-7 text-2xl font-semibold">Email verification</h1><p role="status" className="mt-4 text-sm leading-6 text-slate-300">{status}</p><Link href="/auth" className="mt-7 inline-flex rounded-xl bg-violet-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-400">Continue to sign in</Link></section></main>;
}

export default function VerifyEmailPage() {
  return <Suspense fallback={<main className="grid min-h-screen place-items-center bg-[#050509] text-slate-400">Loading verification…</main>}><VerificationStatus /></Suspense>;
}
