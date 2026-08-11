import type { CrmRecord } from '@/lib/crm/types';

// The escaper and BOM moved to @crm-eco/lib/csv/escape so all four CSV
// producers share one implementation (they had drifted; one omitted `\r` and
// produced corrupt output). Re-exported here to keep existing importers working.
export { CSV_UTF8_BOM, escapeCsvCell } from '@crm-eco/lib/csv/escape';

import { escapeCsvCell } from '@crm-eco/lib/csv/escape';

/**
 * One data line for the given column keys (system columns + `data` JSONB).
 */
/**
 * `projectedData` is the legacy-projected view of `record.data` (see
 * `mergeCrmRecordRowIntoFormDefaults`). Exports must contain what the CRM
 * displays — without it, a Zoho-era value the rep can see on screen exports as
 * an empty cell, which silently under-reports during data reconciliation.
 */
export function formatCsvDataLine(
  record: CrmRecord,
  columns: string[],
  projectedData?: Record<string, unknown> | null,
): string {
  const recordData = record as unknown as Record<string, unknown>;
  const dataJson = (projectedData ??
    (record.data ?? null)) as Record<string, unknown> | null;
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
