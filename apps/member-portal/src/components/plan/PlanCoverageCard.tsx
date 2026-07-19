import Link from 'next/link';
import { Check, FileText, ShieldCheck } from '@phosphor-icons/react/dist/ssr';
import type { PlanOverview } from '@/lib/data/member';
import { Bezel } from '@/components/ui/Bezel';

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
    <Bezel>
      <section aria-label="Coverage summary">
        {/* Hero — Soft Structuralism teal gradient */}
        <div
          className="relative overflow-hidden px-6 py-6 text-white"
          style={{
            background: 'linear-gradient(145deg, #0b6d85 0%, #0e8c9a 55%, #12a065 120%)',
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/15 blur-2xl"
          />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="mp-kicker mp-kicker-light inline-flex items-center gap-1.5">
                <ShieldCheck weight="light" className="h-3.5 w-3.5" aria-hidden />
                Your coverage
              </p>
              <h2 className="mt-1.5 truncate text-2xl font-bold leading-tight tracking-[-0.03em]">
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
            <p className="mt-1 font-mono text-lg font-bold tabular-nums text-[var(--mp-ink)]">
              {premium ?? '—'}
            </p>
          </div>
          <div className="px-6 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {isInsurance ? 'Deductible' : 'IUA (deductible)'}
            </p>
            <p className="mt-1 font-mono text-lg font-bold tabular-nums text-[var(--mp-ink)]">
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
                    className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-[rgba(11,109,133,0.06)] text-[var(--mp-teal)]"
                  >
                    <Check weight="light" className="h-3 w-3" />
                  </span>
                  <span className="min-w-0 truncate">{benefit.label}</span>
                  {benefit.detail ? (
                    <span className="ml-auto shrink-0 font-mono text-sm font-semibold tabular-nums text-[var(--mp-ink)]">
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
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--mp-ink)] px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mp-teal)] focus-visible:ring-offset-2"
          >
            <FileText weight="light" className="h-4 w-4" aria-hidden />
            Plan documents
          </Link>
        </div>
      </section>
    </Bezel>
  );
}
