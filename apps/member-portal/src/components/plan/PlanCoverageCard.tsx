import Link from 'next/link';
import { Check, FileText, ShieldCheck } from 'lucide-react';
import type { PlanOverview } from '@/lib/data/member';

/**
 * PlanCoverageCard — the member's premium "at a glance" coverage card.
 * Presentational + server-safe: every value is passed in from the
 * real-sourced `getPlanOverview()` accessor (no fetching, no fabrication).
 */

function formatMoney(value: number | null): string | null {
  if (value === null) return null;
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  pending: 'bg-amber-100 text-amber-800',
  paused: 'bg-slate-100 text-slate-700',
  terminated: 'bg-rose-100 text-rose-700',
};

export function PlanCoverageCard({
  overview,
  showBenefits = true,
}: {
  overview: PlanOverview;
  /** Hide the benefits list when the page already renders a richer "What's covered" section. */
  showBenefits?: boolean;
}) {
  const isInsurance = overview.marketType === 'insurance' || overview.planType === 'insurance';
  const premium = formatMoney(overview.premium);
  const deductible = formatMoney(overview.deductible);
  const statusKey = (overview.status ?? '').toLowerCase();
  const statusStyle = STATUS_STYLES[statusKey] ?? 'bg-slate-100 text-slate-700';
  const marketLabel = isInsurance ? 'Health insurance' : 'Health sharing';
  // Show the real carrier (e.g. "Cigna") when we have it; otherwise the market label.
  const coverageLine = [overview.coverageOption, overview.carrier ?? marketLabel]
    .filter(Boolean)
    .join(' · ');
  const benefits = showBenefits ? overview.benefits : null;

  return (
    <section
      aria-label="Coverage summary"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-cyan-600 via-cyan-700 to-emerald-600 px-6 py-6 text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/15 blur-2xl"
        />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Your coverage
            </p>
            <h2 className="mt-1.5 truncate text-2xl font-bold leading-tight">
              {overview.planName ?? overview.carrier ?? 'Your plan'}
            </h2>
            {coverageLine ? <p className="mt-1.5 text-sm text-white/85">{coverageLine}</p> : null}
          </div>
          {overview.status ? (
            <span className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold capitalize ring-1 ring-inset ring-white/25 backdrop-blur">
              {overview.status}
            </span>
          ) : null}
        </div>
        {overview.memberNumber ? (
          <div className="relative mt-5 flex items-center justify-between text-xs">
            <span className="text-white/75">Member ID</span>
            <span className="rounded-md bg-white/15 px-2.5 py-1 font-mono tracking-wider tabular-nums ring-1 ring-inset ring-white/20">
              {overview.memberNumber}
            </span>
          </div>
        ) : null}
      </div>

      {/* Key figures */}
      <div className="grid grid-cols-2 divide-x divide-slate-100">
        <div className="px-6 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Monthly {isInsurance ? 'premium' : 'share'}
          </p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-900">
            {premium ?? '—'}
          </p>
        </div>
        <div className="px-6 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {isInsurance ? 'Deductible' : 'IUA (deductible)'}
          </p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-900">
            {deductible ?? '—'}
          </p>
        </div>
      </div>

      {/* Benefits — only when the plan actually defines them */}
      {benefits && benefits.length > 0 ? (
        <div className="border-t border-slate-100 px-6 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Included benefits
          </p>
          <ul className="mt-2.5 space-y-2">
            {benefits.map((benefit, i) => (
              <li key={`${benefit.label}-${i}`} className="flex items-center gap-2.5 text-sm text-slate-700">
                <span
                  aria-hidden
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-emerald-100 text-emerald-700"
                >
                  <Check className="h-3 w-3" />
                </span>
                <span className="min-w-0 truncate">{benefit.label}</span>
                {benefit.detail ? (
                  <span className="ml-auto shrink-0 font-mono text-sm font-semibold tabular-nums text-slate-900">
                    {benefit.detail}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-4">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${statusStyle}`}>
            {overview.status ?? 'unknown'}
          </span>
          {overview.effectiveDate ? (
            <span>Effective {new Date(overview.effectiveDate).toLocaleDateString()}</span>
          ) : null}
        </div>
        <Link
          href="/documents"
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
        >
          <FileText className="h-4 w-4" aria-hidden />
          Plan documents
        </Link>
      </div>
    </section>
  );
}
