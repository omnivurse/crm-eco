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
