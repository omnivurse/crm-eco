import type { CashRateRow } from './types';

/** Relativity below this is almost never a real contracted rate (Rose $1,759 @ 0.14×). */
export const LOW_CMS_FLOOR = 0.35;
/** Relativity above this is a chargemaster fragment, not a payable rate. */
export const HIGH_CMS_CEILING = 4;

export interface OutlierFlag {
  id: string | number;
  reason: 'low_cms' | 'high_cms' | 'below_medicare';
}

export function tickIdentity(row: Pick<CashRateRow, 'id' | 'facilityName' | 'procedureCode' | 'carrier' | 'planName'>): string {
  return `${row.id}|${row.facilityName}|${row.procedureCode}|${row.carrier || ''}|${row.planName || ''}`;
}

/**
 * Hide extreme junk without dropping expensive but real commercial / workers-comp
 * ticks. Low-side only plus a hard CMS-relativity floor/ceiling.
 */
export function flagRateOutliers(rows: CashRateRow[]): Set<string> {
  const flagged = new Set<string>();
  for (const row of rows) {
    const id = tickIdentity(row);
    const rel = row.cmsRelativity;
    if (rel != null && rel < LOW_CMS_FLOOR) {
      flagged.add(id);
      continue;
    }
    if (rel != null && rel > HIGH_CMS_CEILING) {
      flagged.add(id);
      continue;
    }
    if (row.cmsRate != null && row.cmsRate > 0 && row.rate < row.cmsRate * 0.4) {
      flagged.add(id);
    }
  }
  return flagged;
}

export function partitionRates<T extends CashRateRow>(
  rows: T[],
  hidden: Set<string>,
): { kept: T[]; outliers: T[] } {
  const kept: T[] = [];
  const outliers: T[] = [];
  for (const row of rows) {
    (hidden.has(tickIdentity(row)) ? outliers : kept).push(row);
  }
  return { kept, outliers };
}

export function mergeHidden(...sets: Iterable<string>[]): Set<string> {
  const out = new Set<string>();
  for (const set of sets) {
    for (const id of set) out.add(id);
  }
  return out;
}

export function toggleHiddenId(current: Set<string>, id: string): Set<string> {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** Too few ticks for a Tukey fence — leave the tape alone. */
export const EXTREME_MIN_N = 8;
/** Never treat a tick as extreme below this multiple of the median. */
export const EXTREME_MEDIAN_MULT = 2.5;

function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.min(sorted.length - 1, lo + 1);
  const t = pos - lo;
  return sorted[lo] * (1 - t) + sorted[hi] * t;
}

/**
 * Opt-in fence for ticks that warp HIGH / the coach without failing the CMS
 * junk rules (e.g. $1,625 on a $385 median tape at 3.8× Medicare).
 * Tukey high fence, never below {@link EXTREME_MEDIAN_MULT}× median.
 */
export function flagHighExtremes(rows: CashRateRow[]): Set<string> {
  const usable = rows.filter((row) => Number.isFinite(row.rate) && row.rate > 0);
  if (usable.length < EXTREME_MIN_N) return new Set();
  const sorted = usable.map((row) => row.rate).sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = Math.max(0, q3 - q1);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  if (!(median > 0)) return new Set();
  const fence = Math.max(q3 + 1.5 * iqr, median * EXTREME_MEDIAN_MULT);
  const flagged = new Set<string>();
  for (const row of usable) {
    if (row.rate > fence) flagged.add(tickIdentity(row));
  }
  return flagged;
}

export function highestRate(rows: Array<{ rate: number }>): number | null {
  let max = -Infinity;
  for (const row of rows) {
    if (Number.isFinite(row.rate) && row.rate > max) max = row.rate;
  }
  return Number.isFinite(max) ? max : null;
}
