export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-[#09090f] px-5 py-7 text-white sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl animate-pulse space-y-6">
        <div className="h-12 w-2/3 rounded-xl bg-white/[0.06]" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => <div key={item} className="h-32 rounded-2xl border border-white/10 bg-white/[0.04]" />)}
        </div>
        <div className="h-96 rounded-2xl border border-white/10 bg-white/[0.04]" />
      </div>
    </main>
  );
}
