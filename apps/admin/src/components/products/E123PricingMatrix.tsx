'use client';

import { useState, useCallback, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui';
import { Plus, Trash2, Edit, Loader2, DollarSign, Info, AlertTriangle } from 'lucide-react';
import { buildMatrixPreview } from '@crm-eco/rates';
import type {
  RateConfig,
  RateSetKey,
  RatingModel,
  AgeBand,
  FeeLine,
  MatrixPreview,
  CoverageTier,
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

const config = seedConfig as unknown as RateConfig;

export function E123PricingMatrix({ productId, productCode, organizationId }: E123PricingMatrixProps) {
  const [activeRateSet, setActiveRateSet] = useState<RateSetKey>('current');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<MatrixPreview | null>(null);
  const [showAgeBandDialog, setShowAgeBandDialog] = useState(false);
  const [showFeeDialog, setShowFeeDialog] = useState(false);

  const planId = productCode || productId;

  const loadPreview = useCallback(() => {
    setLoading(true);
    try {
      const p = buildMatrixPreview(config, planId, activeRateSet);
      setPreview(p);
      if (!p) {
        setError(`Plan "${planId}" not found in ${activeRateSet} rate set. Configure rates in the seed config.`);
      } else {
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preview');
    } finally {
      setLoading(false);
    }
  }, [planId, activeRateSet]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Rate Set Toggle */}
      <div className="flex items-center gap-4">
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
        {preview && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Badge variant="outline" className="text-xs">
              {preview.ratingModel === 'tiered_household' ? 'Tiered Household' : 'Additive Person'}
            </Badge>
            <span>Effective: {preview.effectiveDate}</span>
          </div>
        )}
      </div>

      {/* 2026 Notice */}
      {activeRateSet === 'rates_2026' && (
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm flex items-center gap-2">
          <Info className="w-4 h-4 flex-shrink-0" />
          Rates effective January 1, 2026
        </div>
      )}

      {/* Matrix */}
      {preview && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Pricing Matrix — {preview.displayName}
            </CardTitle>
            <CardDescription>
              Monthly rates by coverage tier and age band
              {preview.ratingModel === 'additive_person' && ' (derived preview)'}
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
                      <th key={band.id} className="border p-3 bg-slate-100 text-center font-semibold text-slate-700 min-w-[100px]">
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

            {/* Footnotes */}
            {preview.footnotes && preview.footnotes.length > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-100 text-amber-800">
                <p className="text-xs font-semibold uppercase tracking-wider mb-1">Preview Notes</p>
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

      {/* Age Bands */}
      {preview && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Age Bands</CardTitle>
              <CardDescription>Age ranges used for rate lookup</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {preview.ageBands.map((band) => (
                <div key={band.id} className="p-3 rounded-lg border bg-slate-50 text-center">
                  <p className="font-bold text-lg">{band.label}</p>
                  <p className="text-xs text-slate-500">Ages {band.min}–{band.max}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fees */}
      {preview && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Fees</CardTitle>
              <CardDescription>Administrative and enrollment fees</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {(() => {
              const plan = config.rate_sets[activeRateSet].plans.find((p) => p.planId === planId);
              const fees = plan?.fees ?? [];
              if (fees.length === 0) {
                return <p className="text-center text-slate-500 py-4">No fees configured</p>;
              }
              return (
                <div className="space-y-2">
                  {fees.map((fee) => (
                    <div
                      key={fee.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-slate-50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{fee.label}</span>
                        <Badge variant={fee.enabled ? 'default' : 'secondary'} className="text-xs">
                          {fee.enabled ? 'Active' : 'Disabled'}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {fee.type === 'flat_monthly' ? 'Monthly' : fee.type === 'flat_one_time' ? 'One-Time' : 'Percent'}
                        </Badge>
                      </div>
                      <span className="font-bold text-lg">
                        {fee.type === 'percent' ? `${fee.amount}%` : formatCurrency(fee.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
