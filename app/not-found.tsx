import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#09090f] px-6 text-white">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-violet-300">404</p>
        <h1 className="mt-3 text-2xl font-semibold">That page is not in this workspace</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">The address may be outdated or you may not have access to it.</p>
        <Link href="/" className="mt-6 inline-flex rounded-xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-400">Return to Kora</Link>
      </section>
    </main>
  );
}
