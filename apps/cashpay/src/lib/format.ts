export function formatCash(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatNeedle(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '';
  return `${value.toFixed(2)}× Medicare`;
}

export function formatCmsDollars(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return '';
  return formatCash(value);
}

export function formatPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '';
  return `${Math.round(value * 100)}%`;
}

export function tickKey(row: {
  id: number | string;
  facilityName: string;
  procedureCode: string;
  carrier?: string | null;
  planName?: string | null;
}): string {
  return `${row.id}-${row.facilityName}-${row.procedureCode}-${row.carrier || ''}-${row.planName || ''}`;
}
