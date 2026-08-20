import { canonicalizeHeader } from './csv-update';

export const CREATE_IMPORT_BATCH_SIZE = 500;

export type CsvCreateMapping = {
  sourceColumn: string;
  targetField: string;
};

/**
 * Map CSV headers onto the create-import contract (`sourceColumn` stays the
 * raw header so row lookups hit `row[header]`; `targetField` is the alias /
 * snake_case key the API writes). Blank headers are dropped.
 */
export function mappingsFromCsvHeaders(headers: string[]): CsvCreateMapping[] {
  const mappings: CsvCreateMapping[] = [];
  for (const header of headers) {
    const targetField = canonicalizeHeader(header);
    if (targetField) {
      mappings.push({ sourceColumn: header, targetField });
    }
  }
  return mappings;
}

export function isCsvUploadName(name: string): boolean {
  return name.trim().toLowerCase().endsWith('.csv');
}

export function isExcelUploadName(name: string): boolean {
  return /\.(xlsx|xls)$/i.test(name.trim());
}
