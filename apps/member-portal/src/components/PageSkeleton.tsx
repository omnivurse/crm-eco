import { cn } from '@crm-eco/ui/lib/utils';

/**
 * Premium route-level skeleton. Rendered by `loading.tsx` while a server
 * component fetches, so navigation feels instant instead of showing a bare
 * spinner. The layout mirrors a typical member page — a title, a primary
 * (coverage-style) card, and a row of supporting cards — which reads well as
 * a placeholder for the dashboard, coverage, plan and billing pages alike.
 */
function Shimmer({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-lg bg-slate-200/70', className)}
    />
  );
}

export function PageSkeleton() {
  return (
    <div
      className="mx-auto max-w-4xl space-y-6 px-4 py-8"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading…</span>

      {/* Title + subtitle */}
      <div className="space-y-2">
        <Shimmer className="h-7 w-48" />
        <Shimmer className="h-4 w-72" />
      </div>

      {/* Primary card (coverage-style: hero band + two stat cells) */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <Shimmer className="h-28 w-full rounded-none bg-slate-200/60" />
        <div className="grid grid-cols-2 divide-x divide-slate-100">
          <div className="space-y-2 p-5">
            <Shimmer className="h-3 w-20" />
            <Shimmer className="h-5 w-24" />
          </div>
          <div className="space-y-2 p-5">
            <Shimmer className="h-3 w-20" />
            <Shimmer className="h-5 w-24" />
          </div>
        </div>
      </div>

      {/* Supporting cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <Shimmer className="h-8 w-8 rounded-lg" />
            <Shimmer className="h-4 w-24" />
            <Shimmer className="h-3 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}
