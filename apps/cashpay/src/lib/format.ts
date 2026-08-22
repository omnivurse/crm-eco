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
  return `${value.toFixed(2)}x CMS`;
}

export function tickKey(row: { id: number | string; facilityName: string; procedureCode: string }): string {
  return `${row.id}-${row.facilityName}-${row.procedureCode}`;
}
