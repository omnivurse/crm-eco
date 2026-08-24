import type { CashRateRow } from './types';
import { classifyPayer } from './payer';

export interface NegotiatePlan {
  /** Median published CMS dollar on this slice. */
  medicare: number | null;
  /** Lowest kept tick (after outlier fence). */
  lowestKept: number | null;
  /** Median kept tick. */
  medianKept: number | null;
  /** 20% above the lowest kept rate — the cash offer if Medicare is refused. */
  cashOffer: number | null;
  medicareTicks: number;
  commercialLow: number | null;
}

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Coaching numbers for one slice of kept ticks.
 * Never invents a Medicare dollar — uses HCL `cmsRate` when present.
 */
export function planNegotiation(kept: CashRateRow[]): NegotiatePlan {
  const cms = kept
    .map((row) => row.cmsRate)
    .filter((n): n is number => typeof n === 'number' && n > 0)
    .sort((a, b) => a - b);
  const rates = kept
    .map((row) => row.rate)
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  const commercial = kept
    .filter((row) => classifyPayer(row) === 'commercial')
    .map((row) => row.rate)
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  const lowestKept = rates[0] ?? null;
  const medicare = median(cms);
  return {
    medicare,
    lowestKept,
    medianKept: median(rates),
    cashOffer: lowestKept != null ? Math.round(lowestKept * 1.2) : null,
    medicareTicks: kept.filter((row) => classifyPayer(row) === 'medicare').length,
    commercialLow: commercial[0] ?? null,
  };
}

export function bidDelta(bid: number, medicare: number | null): number | null {
  if (!Number.isFinite(bid) || bid <= 0) return null;
  if (medicare == null || medicare <= 0) return null;
  return bid - medicare;
}
