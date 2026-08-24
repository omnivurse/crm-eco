import type { CashRateRow } from './types';

export type PayerClass =
  | 'medicare'
  | 'medicaid'
  | 'commercial'
  | 'cash'
  | 'workers_comp'
  | 'other';

const CLASS_LABEL: Record<PayerClass, string> = {
  medicare: 'Medicare',
  medicaid: 'Medicaid',
  commercial: 'Commercial',
  cash: 'Cash pay',
  workers_comp: 'Workers’ comp',
  other: 'Other',
};

export function classifyPayer(row: Pick<CashRateRow, 'carrier' | 'lob' | 'planName'>): PayerClass {
  const blob = `${row.lob || ''} ${row.carrier || ''} ${row.planName || ''}`.toLowerCase();
  if (/\bself\s*pay\b|\bcash\b/.test(blob)) return 'cash';
  if (/workers?\s*comp|workcomp/.test(blob)) return 'workers_comp';
  if (/\bmedicaid\b/.test(blob)) return 'medicaid';
  if (/\bmedicare\b|\bmcr\b|\bmcradv/.test(blob)) return 'medicare';
  if (/\bcommercial\b|\bppo\b|\bhmo\b|\bpos\b/.test(blob)) return 'commercial';
  const lob = (row.lob || '').trim().toLowerCase();
  if (lob === 'medicare') return 'medicare';
  if (lob === 'medicaid') return 'medicaid';
  if (lob === 'commercial') return 'commercial';
  if (lob === 'self pay') return 'cash';
  return row.carrier || row.planName ? 'other' : 'cash';
}

export function payerClassLabel(payerClass: PayerClass): string {
  return CLASS_LABEL[payerClass];
}

/** Owner-facing who-pays line. Never invent a carrier. */
export function describePayer(
  row: Pick<CashRateRow, 'carrier' | 'planName' | 'lob' | 'paymentMethod' | 'product'>,
): string {
  const carrier = (row.carrier || '').trim();
  const lob = (row.lob || '').trim();
  if (carrier && lob && !sameToken(carrier, lob)) return `${carrier} · ${lob}`;
  if (carrier) return carrier;
  const plan = (row.planName || '').trim();
  if (plan) return plan;
  const method = (row.paymentMethod || '').trim();
  if (method && !/^facility only$/i.test(method)) return method;
  return 'Unnamed payer';
}

export function describePlan(row: Pick<CashRateRow, 'planName' | 'product'>): string {
  const plan = (row.planName || '').trim();
  if (plan && !/^self\s*pay$/i.test(plan)) return shortenPlan(plan);
  return (row.product || '').trim();
}

function sameToken(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function shortenPlan(plan: string): string {
  return plan.length > 42 ? `${plan.slice(0, 40).trim()}…` : plan;
}

export function uniquePayers(rows: Array<Pick<CashRateRow, 'carrier' | 'lob' | 'planName'>>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    const name = (row.carrier || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out.sort((a, b) => a.localeCompare(b));
}
