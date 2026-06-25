'use client';

import { Card, CardContent, CardHeader, CardTitle, Badge } from '@crm-eco/ui';
import { DollarSign, AlertTriangle } from 'lucide-react';
import type { QuoteResult } from '@crm-eco/rates/types';

interface PricingQuoteProps {
  /**
   * Server-computed quote. The server is the pricing authority — this component
   * never computes a price client-side; it only renders the result it is given.
   */
  result: QuoteResult | null;
  /**
   * Flat plan monthly share to show when no server quote is available
   * (e.g. no rate set configured / quote error). When omitted and `result`
   * is null, nothing renders.
   */
  fallbackMonthlyShare?: number;
}

export function PricingQuote({ result, fallbackMonthlyShare }: PricingQuoteProps) {
  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  // Fallback: no server-computed quote, but we have a flat plan price to show.
  if (!result) {
    if (fallbackMonthlyShare === undefined) return null;

    return (
      <Card className="border-teal-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Your Estimated Monthly Cost
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-2">
            <p className="text-3xl font-bold text-teal-700">
              {formatCurrency(fallbackMonthlyShare)}
            </p>
            <p className="text-xs text-slate-500 mt-1">per month</p>
          </div>
        </CardContent>
      </Card>
    );
  }

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
