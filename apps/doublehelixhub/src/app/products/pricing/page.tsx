import type { Metadata } from 'next';
import Link from 'next/link';
import { buildMatrixPreview, getPlanOptions } from '@crm-eco/rates';
import type { RateConfig, CoverageTier } from '@crm-eco/rates/types';
import seedConfig from '@crm-eco/rates/config';

export const metadata: Metadata = {
  title: 'MSA Pricing Matrix | Double Helix Hub',
  description:
    'Provisional PIFH MSA rate cards — Individual and Group tiers by IUA, age band, and coverage level.',
};

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

export default function MsaPricingPage() {
  const plans = getPlanOptions(config, 'current');

  return (
    <main className="min-h-screen text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-16 space-y-10">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-teal-300/80">Rate engine</p>
          <h1 className="font-serif text-4xl tracking-tight">MSA provisional pricing</h1>
          <p className="max-w-2xl text-muted-foreground text-sm leading-relaxed">
            Shared <code className="text-teal-200">@crm-eco/rates</code> matrix used by admin, CRM,
            member portal, website, and embeddable quote widgets. Partnership (doctor/nurse) costs
            and wellness lab panel are not included. Enrollment contribution is configurable
            separately.
          </p>
          <Link href="/products" className="inline-block text-sm text-teal-300 hover:underline">
            ← Products
          </Link>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Provisional rates — not final. Founding-member enrollment contribution waiver is
          settings-driven ($800 list / $650 waiver proposed).
        </div>

        <div className="space-y-12">
          {plans.map((plan) => {
            const preview = buildMatrixPreview(config, plan.planId, 'current');
            if (!preview) return null;
            return (
              <section
                key={plan.planId}
                className="rounded-2xl border border-border bg-white/[0.03] p-6 space-y-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-xl font-semibold">{preview.displayName}</h2>
                  <p className="text-xs text-muted-foreground font-mono">{plan.planId}</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className="border border-border p-2 text-left text-muted-foreground">
                          Coverage
                        </th>
                        {preview.ageBands.map((band) => (
                          <th
                            key={band.id}
                            className="border border-border p-2 text-center text-muted-foreground"
                          >
                            {band.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.coverageTiers.map((tier) => (
                        <tr key={tier}>
                          <td className="border border-border p-2 text-foreground/90">
                            {TIER_LABELS[tier]}
                          </td>
                          {preview.ageBands.map((band) => (
                            <td
                              key={band.id}
                              className="border border-border p-2 text-center tabular-nums"
                            >
                              {formatCurrency(preview.matrix[tier]?.[band.id] ?? 0)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {preview.footnotes && (
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {preview.footnotes.map((fn, i) => (
                      <li key={i}>* {fn}</li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
