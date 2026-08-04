import type { ColumnDef } from './types';

/**
 * CSV cell escaping.
 *
 * Kept local deliberately: `@crm-eco/ui` has no dependency on `@crm-eco/lib`,
 * and a UI package should not start depending on the data layer just to share
 * ten lines. The canonical implementation is
 * `packages/lib/src/csv/escape.ts` — keep the two in step; its test file covers
 * the cases below.
 *
 * The `'` prefix on formula characters matters: without it a record field such
 * as `=HYPERLINK("https://evil.example","Click")` executes when a staff member
 * opens the export in Excel, Sheets or LibreOffice.
 */
const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return '';

  let str = typeof value === 'object' ? JSON.stringify(value) : String(value);

  if (str.length > 0 && FORMULA_PREFIXES.includes(str[0])) {
    str = `'${str}`;
  }

  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsv<Row>(
  rows: Row[],
  columns: ColumnDef<Row>[],
): string {
  const header = columns.map((c) => escapeCsv(c.header)).join(',');
  const body = rows
    .map((row) =>
      columns
        .map((c) => {
          const raw = c.exportValue ? c.exportValue(row) : c.accessor(row);
          return escapeCsv(raw);
        })
        .join(','),
    )
    .join('\n');
  return `${header}\n${body}`;
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
