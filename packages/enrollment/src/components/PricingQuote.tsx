'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@crm-eco/ui';
import { DollarSign, AlertTriangle, ChevronDown } from 'lucide-react';
import { quote } from '@crm-eco/rates';
import type { RateConfig, QuoteInput, QuoteResult, QuoteOptions, CoverageTier, RateSetKey } from '@crm-eco/rates/types';
import seedConfig from '@crm-eco/rates/config';

const config = seedConfig as unknown as RateConfig;

interface PricingQuoteProps {
  planId: string;
  coverageTier: CoverageTier;
  memberAge: number;
  spouseAge?: number;
  dependentAges?: number[];
  coverageStart: string;
  rateSetOverride?: RateSetKey | null;
}

export function PricingQuote({
  planId,
  coverageTier,
  memberAge,
  spouseAge,
  dependentAges,
  coverageStart,
  rateSetOverride,
}: PricingQuoteProps) {
  const result = useMemo<QuoteResult | null>(() => {
    if (!planId || !memberAge || !coverageStart) return null;

    const input: QuoteInput = {
      planId,
      coverageTier,
      household: {
        memberAge,
        ...(spouseAge !== undefined ? { spouseAge } : {}),
        ...(dependentAges?.length ? { dependentAges } : {}),
      },
      coverageStart,
    };

    const opts: QuoteOptions = {};
    if (rateSetOverride) {
      opts.rateSetOverride = rateSetOverride;
    }

    return quote(config, input, Object.keys(opts).length > 0 ? opts : undefined);
  }, [planId, coverageTier, memberAge, spouseAge, dependentAges, coverageStart, rateSetOverride]);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  if (!result) return null;

  const hasErrors = result.errors && result.errors.length > 0;

  return (
    <Card className={hasErrors ? 'border-amber-200' : 'border-teal-200'}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Your Estimated Monthly Cost
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasErrors ? (
          <div className="p-3 rounded-lg bg-amber-50 text-amber-800 text-sm space-y-1">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-medium">Unable to calculate quote</span>
            </div>
            {result.errors!.map((e, i) => (
              <p key={i} className="text-xs">{e.message}</p>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Total */}
            <div className="text-center py-2">
              <p className="text-3xl font-bold text-teal-700">
                {formatCurrency(result.totalMonthly)}
              </p>
              <p className="text-xs text-slate-500 mt-1">per month</p>
            </div>

            {/* Breakdown */}
            <div className="border-t pt-3 space-y-1.5">
              {result.breakdown.map((line, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-slate-600">{line.label}</span>
                  <span className="font-medium tabular-nums">{formatCurrency(line.amount)}</span>
                </div>
              ))}
              {result.monthlyFees.map((fee, i) => (
                <div key={`fee-${i}`} className="flex justify-between text-sm">
                  <span className="text-slate-600">{fee.label}</span>
                  <span className="font-medium tabular-nums">{formatCurrency(fee.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold pt-1.5 border-t">
                <span>Total Monthly</span>
                <span className="tabular-nums">{formatCurrency(result.totalMonthly)}</span>
              </div>
            </div>

            {/* One-time fees */}
            {result.oneTimeFees.length > 0 && (
              <div className="border-t pt-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  One-Time Fees
                </p>
                {result.oneTimeFees.map((fee, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-slate-600">{fee.label}</span>
                    <span className="font-medium tabular-nums">{formatCurrency(fee.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Rate set badge */}
            <div className="flex items-center gap-2 pt-1">
              <Badge variant="outline" className="text-xs">
                {result.metadata.rateSetLabel}
              </Badge>
              <span className="text-xs text-slate-400">
                Effective {result.metadata.effectiveDate}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
