"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#09090f] px-6 text-white">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center shadow-2xl">
        <p className="text-xs uppercase tracking-[0.2em] text-violet-300">Kora</p>
        <h1 className="mt-3 text-2xl font-semibold">Something needs another try</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">The workspace could not finish loading. Your data was not changed.{error.digest ? ` Reference: ${error.digest}` : ""}</p>
        <button type="button" onClick={() => reset()} className="mt-6 rounded-xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-400">Try again</button>
      </section>
    </main>
  );
}
