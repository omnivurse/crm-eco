import type { CrmRecord } from '@/lib/crm/types';

/** Excel-friendly UTF-8 */
export const CSV_UTF8_BOM = '\uFEFF';

/**
 * Escape a single value for CSV (RFC-style quoting when needed).
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * One data line for the given column keys (system columns + `data` JSONB).
 */
export function formatCsvDataLine(record: CrmRecord, columns: string[]): string {
  const recordData = record as unknown as Record<string, unknown>;
  const dataJson = (record.data ?? null) as Record<string, unknown> | null;
  return columns
    .map((col) => {
      const v = recordData[col] ?? dataJson?.[col];
      return escapeCsvCell(v);
    })
    .join(',');
}

/** Safe ASCII filename fragment for Content-Disposition */
export function sanitizeExportFilenamePart(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'records';
}
