export function DashboardSkeleton() {
  return (
    <div className="space-y-8 pb-8">
      {/* Hero skeleton */}
      <div className="h-64 bg-gradient-to-br from-slate-200 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-3xl animate-pulse" />

      {/* Stats grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-32 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse"
          />
        ))}
      </div>

      {/* Toolbar skeleton */}
      <div className="h-14 bg-slate-100 dark:bg-slate-800/50 rounded-xl animate-pulse" />

      {/* Main content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <div className="h-80 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
          <div className="h-80 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
        </div>
        <div className="lg:col-span-2 space-y-6">
          <div className="h-80 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
          <div className="h-80 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}
