'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from '@crm-eco/ui';
import { DollarSign, Info } from 'lucide-react';
import { buildMatrixPreview } from '@crm-eco/rates';
import type { RateConfig, RateSetKey, CoverageTier } from '@crm-eco/rates/types';
import seedConfig from '@crm-eco/rates/config';

const seed = seedConfig as unknown as RateConfig;

interface PricingMatrixProps {
  planId: string;
  rateSetOverride?: RateSetKey | null;
  allowPreview?: boolean;
  /** When provided, used instead of the MSA seed config */
  rateConfig?: RateConfig | null;
}

const TIER_LABELS: Record<CoverageTier, string> = {
  member: 'Member',
  member_spouse: 'Member + Spouse',
  member_children: 'Member + Children',
  family: 'Family',
};

export function PricingMatrix({
  planId,
  rateSetOverride,
  allowPreview = false,
  rateConfig,
}: PricingMatrixProps) {
  const config = rateConfig ?? seed;
  const [activeRateSet, setActiveRateSet] = useState<RateSetKey>(
    (rateSetOverride as RateSetKey) || 'current'
  );

  const preview = useMemo(
    () => buildMatrixPreview(config, planId, activeRateSet),
    [planId, activeRateSet, config]
  );

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  if (!preview) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="h-5 w-5" />
              {preview.displayName} — Pricing
            </CardTitle>
            <CardDescription>Monthly rates by coverage tier</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {preview.provisional && (
              <Badge className="text-xs bg-amber-100 text-amber-900 hover:bg-amber-100">
                Provisional
              </Badge>
            )}
            {allowPreview && (
              <div className="flex rounded-md border overflow-hidden">
                {(['current', 'rates_2026'] as RateSetKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setActiveRateSet(key)}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      activeRateSet === key
                        ? 'bg-teal-600 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {key === 'current' ? 'Current' : '2026'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {preview.provisional && (
          <div className="mb-4 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
            <Info className="w-3.5 h-3.5 flex-shrink-0" />
            Provisional MSA rates — partnership and wellness lab costs not included.
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border p-2.5 bg-slate-50 text-left font-semibold text-slate-700">
                  Coverage
                </th>
                {preview.ageBands.map((band) => (
                  <th
                    key={band.id}
                    className="border p-2.5 bg-slate-50 text-center font-semibold text-slate-700"
                  >
                    {band.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.coverageTiers.map((tier) => (
                <tr key={tier} className="hover:bg-slate-50/50">
                  <td className="border p-2.5 font-medium text-slate-700">{TIER_LABELS[tier]}</td>
                  {preview.ageBands.map((band) => (
                    <td key={band.id} className="border p-2.5 text-center tabular-nums font-medium">
                      {formatCurrency(preview.matrix[tier]?.[band.id] ?? 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {preview.footnotes && preview.footnotes.length > 0 && (
          <div className="mt-3 text-xs text-slate-500 space-y-0.5">
            {preview.footnotes.map((fn, i) => (
              <p key={i}>* {fn}</p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
