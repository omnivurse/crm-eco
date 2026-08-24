import type { CashRateRow } from './types';
import { classifyPayer, payerClassLabel, type PayerClass } from './payer';

export const PAYER_MIX_ORDER: readonly PayerClass[] = [
  'medicare',
  'commercial',
  'medicaid',
  'cash',
  'workers_comp',
  'other',
];

export type PayerMix = Record<PayerClass, number>;

export function emptyPayerMix(): PayerMix {
  return {
    medicare: 0,
    medicaid: 0,
    commercial: 0,
    cash: 0,
    workers_comp: 0,
    other: 0,
  };
}

/** Counts by classified LOB. Never invents a carrier. */
export function payerMix(rows: Array<Pick<CashRateRow, 'carrier' | 'lob' | 'planName'>>): PayerMix {
  const mix = emptyPayerMix();
  for (const row of rows) {
    mix[classifyPayer(row)] += 1;
  }
  return mix;
}

export function mixEntries(mix: PayerMix): Array<{ id: PayerClass; label: string; count: number }> {
  return PAYER_MIX_ORDER.map((id) => ({
    id,
    label: payerClassLabel(id),
    count: mix[id],
  })).filter((entry) => entry.count > 0);
}

/**
 * Discount off the published chargemaster (`grossCharges`).
 * Null when the file has no list, or the tick is above list.
 */
export function listDiscount(row: Pick<CashRateRow, 'rate' | 'grossCharges'>): number | null {
  const list = row.grossCharges;
  if (list == null || !Number.isFinite(list) || list <= 0) return null;
  if (!Number.isFinite(row.rate) || row.rate <= 0 || row.rate > list) return null;
  return 1 - row.rate / list;
}

export function medianListDiscount(
  rows: Array<Pick<CashRateRow, 'rate' | 'grossCharges'>>,
): number | null {
  const values = rows
    .map(listDiscount)
    .filter((n): n is number => n != null)
    .sort((a, b) => a - b);
  if (values.length === 0) return null;
  const mid = Math.floor(values.length / 2);
  return values.length % 2 === 1 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
}

export function websiteHref(url: string | null | undefined): string | null {
  const raw = (url || '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^\/\//.test(raw)) return `https:${raw}`;
  return `https://${raw.replace(/^\/+/, '')}`;
}

export function describeFacilityLine(
  row: Pick<
    CashRateRow,
    'city' | 'state' | 'hospitalType' | 'healthsystemType' | 'corporateEntity' | 'msaName'
  >,
  opts?: { includeMetro?: boolean },
): string {
  const parts = [
    [row.city, row.state].filter(Boolean).join(', '),
    row.hospitalType,
    row.healthsystemType,
    row.corporateEntity,
  ].filter(Boolean);
  if (opts?.includeMetro && row.msaName) parts.push(row.msaName);
  return parts.join(' · ');
}

export interface FacilitySpread {
  low: number | null;
  high: number | null;
  payerCount: number;
  tickCount: number;
}

/** Same facility, this page: published band and how many named payers. */
export function facilitySpread(
  ticks: Array<Pick<CashRateRow, 'rate' | 'carrier' | 'planName'>>,
): FacilitySpread {
  const rates = ticks.map((t) => t.rate).filter((n) => Number.isFinite(n) && n > 0);
  const payers = new Set(
    ticks
      .map((t) => (t.carrier || t.planName || '').trim().toLowerCase())
      .filter(Boolean),
  );
  return {
    low: rates.length ? Math.min(...rates) : null,
    high: rates.length ? Math.max(...rates) : null,
    payerCount: payers.size,
    tickCount: ticks.length,
  };
}
