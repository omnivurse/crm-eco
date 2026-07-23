import type { ColumnDef } from './types';

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
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
