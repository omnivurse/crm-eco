'use client';

import { CircleNotch, CurrencyDollar, Info, Warning } from '@phosphor-icons/react';
import { useState, useCallback, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
} from '@crm-eco/ui';
import { buildMatrixPreview } from '@crm-eco/rates';
import type {
  RateConfig,
  RateSetKey,
  MatrixPreview,
  CoverageTier,
  FeeLine,
} from '@crm-eco/rates/types';
import seedConfig from '@crm-eco/rates/config';

interface E123PricingMatrixProps {
  productId: string;
  productCode: string;
  organizationId: string;
}

const TIER_LABELS: Record<CoverageTier, string> = {
  member: 'Member',
  member_spouse: 'Member + Spouse',
  member_children: 'Member + Children',
  family: 'Family',
};

const seed = seedConfig as unknown as RateConfig;

export function E123PricingMatrix({ productId, productCode }: E123PricingMatrixProps) {
  const [activeRateSet, setActiveRateSet] = useState<RateSetKey>('current');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<MatrixPreview | null>(null);
  const [config, setConfig] = useState<RateConfig>(seed);
  const [configSource, setConfigSource] = useState<'database' | 'seed'>('seed');

  const planId = productCode || productId;

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/rates/config?planId=${encodeURIComponent(productId)}`);
      if (res.ok) {
        const dbConfig = (await res.json()) as RateConfig;
        const hasPlans =
          (dbConfig.rate_sets?.current?.plans?.length ?? 0) > 0 ||
          (dbConfig.rate_sets?.rates_2026?.plans?.length ?? 0) > 0;
        if (hasPlans) {
          setConfig(dbConfig);
          setConfigSource('database');
          setError(null);
          return;
        }
      }
      setConfig(seed);
      setConfigSource('seed');
      setError(null);
    } catch {
      setConfig(seed);
      setConfigSource('seed');
      setError('Could not load DB rate config — showing seed MSA tables.');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    const p = buildMatrixPreview(config, planId, activeRateSet);
    setPreview(p);
    if (!p && !loading) {
      setError(
        `Plan "${planId}" not found in ${activeRateSet} rate set (${configSource}). Configure rates or apply the MSA migration.`
      );
    }
  }, [config, planId, activeRateSet, configSource, loading]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const fees: FeeLine[] =
    config.rate_sets[activeRateSet]?.plans.find((p) => p.planId === planId)?.fees ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <CircleNotch weight="light" className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-start gap-2">
          <Warning weight="light" className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex rounded-lg border overflow-hidden">
          {(['current', 'rates_2026'] as RateSetKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setActiveRateSet(key)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeRateSet === key
                  ? 'bg-[#0f172a] text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {key === 'current' ? 'Current Rates' : '2026 Rates'}
            </button>
          ))}
        </div>
        <Badge variant="outline" className="text-xs">
          Source: {configSource === 'database' ? 'Database' : 'Seed (provisional)'}
        </Badge>
        {preview && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Badge variant="outline" className="text-xs">
              {preview.ratingModel === 'tiered_household' ? 'Tiered Household' : 'Additive Person'}
            </Badge>
            {preview.provisional && (
              <Badge className="text-xs bg-amber-100 text-amber-900 hover:bg-amber-100">
                Provisional
              </Badge>
            )}
            <span>Effective: {preview.effectiveDate}</span>
          </div>
        )}
      </div>

      {preview?.provisional && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-center gap-2">
          <Info weight="light" className="w-4 h-4 flex-shrink-0" />
          Provisional MSA rates — partnership (doctor/nurse) costs and wellness lab panel are not
          included. Enrollment contribution is configurable.
        </div>
      )}

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CurrencyDollar weight="light" className="h-5 w-5" />
              Pricing Matrix — {preview.displayName}
            </CardTitle>
            <CardDescription>
              Monthly rates by coverage tier and age band
              {preview.ageRatingBasis === 'older_of_couple'
                ? ' · Individual: older spouse for couple/family'
                : preview.marketSegment === 'group'
                  ? ' · Group: employee age'
                  : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border p-3 bg-slate-100 text-left font-semibold text-slate-700 min-w-[160px]">
                      Coverage Tier
                    </th>
                    {preview.ageBands.map((band) => (
                      <th
                        key={band.id}
                        className="border p-3 bg-slate-100 text-center font-semibold text-slate-700 min-w-[100px]"
                      >
                        {band.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.coverageTiers.map((tier) => (
                    <tr key={tier} className="hover:bg-slate-50 transition-colors">
                      <td className="border p-3 bg-slate-50 font-medium text-slate-700">
                        {TIER_LABELS[tier] || tier}
                      </td>
                      {preview.ageBands.map((band) => {
                        const rate = preview.matrix[tier]?.[band.id];
                        return (
                          <td key={band.id} className="border p-3 text-center tabular-nums">
                            {rate !== undefined ? (
                              <span className="font-semibold text-slate-900">
                                {formatCurrency(rate)}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {preview.footnotes && preview.footnotes.length > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-100 text-amber-800">
                <p className="text-xs font-semibold uppercase tracking-wider mb-1">Notes</p>
                <ul className="text-xs space-y-0.5">
                  {preview.footnotes.map((fn, i) => (
                    <li key={i}>* {fn}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle>Age Bands</CardTitle>
            <CardDescription>Age ranges used for rate lookup</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {preview.ageBands.map((band) => (
                <div key={band.id} className="p-3 rounded-lg border bg-slate-50 text-center">
                  <p className="font-bold text-lg">{band.label}</p>
                  <p className="text-xs text-slate-500">
                    Ages {band.min}–{band.max}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle>Fees</CardTitle>
            <CardDescription>Enrollment contribution and stubbed future costs</CardDescription>
          </CardHeader>
          <CardContent>
            {fees.length === 0 ? (
              <p className="text-center text-slate-500 py-4">No fees configured</p>
            ) : (
              <div className="space-y-2">
                {fees.map((fee) => (
                  <div
                    key={fee.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-slate-50"
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-medium">{fee.label}</span>
                      <Badge variant={fee.enabled ? 'default' : 'secondary'} className="text-xs">
                        {fee.enabled ? 'Active' : 'Disabled'}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {fee.type === 'flat_monthly'
                          ? 'Monthly'
                          : fee.type === 'flat_one_time'
                            ? 'One-Time'
                            : 'Percent'}
                      </Badge>
                    </div>
                    <span className="font-bold text-lg">
                      {fee.type === 'percent' ? `${fee.amount}%` : formatCurrency(fee.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
