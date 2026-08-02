import { buildMatrixPreview, getPlanOptions } from '@crm-eco/rates';
import type { RateConfig, CoverageTier } from '@crm-eco/rates/types';
import seedConfig from '@crm-eco/rates/config';

const config = seedConfig as unknown as RateConfig;

const TIER_LABELS: Record<CoverageTier, string> = {
  member: 'Member Only',
  member_spouse: 'Member + Spouse',
  member_children: 'Member + Child(ren)',
  family: 'Member + Family',
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export default function AdvisorMsaPricingPage() {
  const plans = getPlanOptions(config, 'current');

  return (
    <div className="space-y-8 p-6 md:p-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-[var(--adv-ink,#0f172a)]">MSA pricing</h1>
        <p className="text-sm text-[var(--adv-slate,#64748b)] max-w-2xl">
          Provisional monthly shares by IUA, age band, and coverage. Individual couple pricing uses
          the older spouse; Group pricing uses the employee&apos;s age. Partnership and wellness lab
          costs are not included.
        </p>
        <p className="text-xs rounded-lg border border-amber-200 bg-amber-50 text-amber-900 px-3 py-2 inline-block">
          Rates are provisional and may change before launch.
        </p>
      </div>

      <div className="space-y-10">
        {plans.map((plan) => {
          const preview = buildMatrixPreview(config, plan.planId, 'current');
          if (!preview) return null;
          return (
            <section
              key={plan.planId}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">{preview.displayName}</h2>
                <span className="text-xs font-mono text-slate-500">{plan.planId}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="border p-2 bg-slate-50 text-left">Coverage</th>
                      {preview.ageBands.map((band) => (
                        <th key={band.id} className="border p-2 bg-slate-50 text-center">
                          {band.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.coverageTiers.map((tier) => (
                      <tr key={tier}>
                        <td className="border p-2 font-medium">{TIER_LABELS[tier]}</td>
                        {preview.ageBands.map((band) => (
                          <td key={band.id} className="border p-2 text-center tabular-nums">
                            {formatCurrency(preview.matrix[tier]?.[band.id] ?? 0)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
