import type { ExportOptions, ExportResult, ExportFormat, ColumnType } from './types.js';

// ============================================================================
// EXPORT UTILITIES
// ============================================================================

/**
 * Format a value based on column type
 */
export function formatValueForExport(
  value: unknown,
  type: ColumnType,
  dateFormat?: string
): string {
  if (value === null || value === undefined) return '';

  switch (type) {
    case 'date':
      return formatDate(value, dateFormat || 'YYYY-MM-DD');
    case 'datetime':
      return formatDate(value, dateFormat || 'YYYY-MM-DD HH:mm:ss');
    case 'currency':
      return formatCurrency(value);
    case 'percent':
      return formatPercent(value);
    case 'boolean':
      return value ? 'Yes' : 'No';
    case 'json':
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
    default:
      return String(value);
  }
}

/**
 * Format date value
 */
function formatDate(value: unknown, format: string): string {
  try {
    const date = new Date(value as string);
    if (isNaN(date.getTime())) return String(value);

    // Simple format replacement
    return format
      .replace('YYYY', date.getFullYear().toString())
      .replace('MM', (date.getMonth() + 1).toString().padStart(2, '0'))
      .replace('DD', date.getDate().toString().padStart(2, '0'))
      .replace('HH', date.getHours().toString().padStart(2, '0'))
      .replace('mm', date.getMinutes().toString().padStart(2, '0'))
      .replace('ss', date.getSeconds().toString().padStart(2, '0'));
  } catch {
    return String(value);
  }
}

/**
 * Format currency value
 */
function formatCurrency(value: unknown): string {
  const num = Number(value);
  if (isNaN(num)) return String(value);
  return num.toFixed(2);
}

/**
 * Format percent value
 */
function formatPercent(value: unknown): string {
  const num = Number(value);
  if (isNaN(num)) return String(value);
  return `${num.toFixed(2)}%`;
}

// ============================================================================
// CSV EXPORT
// ============================================================================

/**
 * Escape a value for CSV
 */
function escapeCsvValue(value: string): string {
  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Convert data to CSV string
 */
export function convertToCSV(
  data: Record<string, unknown>[],
  columns: string[],
  columnTypes?: Record<string, ColumnType>,
  options?: Partial<ExportOptions>
): string {
  const includeHeaders = options?.includeHeaders ?? true;
  const dateFormat = options?.dateFormat;

  const lines: string[] = [];

  // Add header row
  if (includeHeaders) {
    const headers = columns.map((col) => {
      // Convert column key to readable label
      const label = col
        .replace(/_/g, ' ')
        .replace(/\./g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      return escapeCsvValue(label);
    });
    lines.push(headers.join(','));
  }

  // Add data rows
  for (const row of data) {
    const values = columns.map((col) => {
      const value = row[col] ?? row[col.replace('.', '_')] ?? '';
      const type = columnTypes?.[col] || 'text';
      const formatted = formatValueForExport(value, type, dateFormat);
      return escapeCsvValue(formatted);
    });
    lines.push(values.join(','));
  }

  return lines.join('\n');
}

/**
 * Export data to CSV
 */
export function exportToCSV(
  data: Record<string, unknown>[],
  columns: string[],
  columnTypes?: Record<string, ColumnType>,
  options?: Partial<ExportOptions>
): ExportResult {
  const csv = convertToCSV(data, columns, columnTypes, options);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const filename = options?.filename || `report-${new Date().toISOString().split('T')[0]}.csv`;

  return {
    blob,
    filename,
    mimeType: 'text/csv',
  };
}

// ============================================================================
// EXCEL EXPORT (Basic Implementation)
// ============================================================================

/**
 * Convert data to Excel XML format
 * This creates a simple XML Spreadsheet that Excel can open
 */
export function convertToExcelXML(
  data: Record<string, unknown>[],
  columns: string[],
  columnTypes?: Record<string, ColumnType>,
  options?: Partial<ExportOptions>
): string {
  const includeHeaders = options?.includeHeaders ?? true;
  const dateFormat = options?.dateFormat;

  // Create header labels
  const headerLabels = columns.map((col) =>
    col
      .replace(/_/g, ' ')
      .replace(/\./g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );

  // Start building XML
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
  <Style ss:ID="Default" ss:Name="Normal">
    <Alignment ss:Vertical="Bottom"/>
    <Font ss:FontName="Arial" ss:Size="10"/>
  </Style>
  <Style ss:ID="Header">
    <Alignment ss:Vertical="Bottom"/>
    <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1"/>
    <Interior ss:Color="#CCCCCC" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Currency">
    <NumberFormat ss:Format="$#,##0.00"/>
  </Style>
  <Style ss:ID="Percent">
    <NumberFormat ss:Format="0.00%"/>
  </Style>
  <Style ss:ID="Date">
    <NumberFormat ss:Format="yyyy-mm-dd"/>
  </Style>
</Styles>
<Worksheet ss:Name="Report">
<Table>
`;

  // Add column widths
  columns.forEach(() => {
    xml += `<Column ss:Width="100"/>\n`;
  });

  // Add header row
  if (includeHeaders) {
    xml += '<Row>\n';
    headerLabels.forEach((header) => {
      xml += `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(header)}</Data></Cell>\n`;
    });
    xml += '</Row>\n';
  }

  // Add data rows
  for (const row of data) {
    xml += '<Row>\n';
    columns.forEach((col) => {
      const value = row[col] ?? row[col.replace('.', '_')] ?? '';
      const type = columnTypes?.[col] || 'text';
      const { cellType, cellValue, styleId } = getExcelCellData(value, type, dateFormat);

      const styleAttr = styleId ? ` ss:StyleID="${styleId}"` : '';
      xml += `<Cell${styleAttr}><Data ss:Type="${cellType}">${escapeXml(cellValue)}</Data></Cell>\n`;
    });
    xml += '</Row>\n';
  }

  xml += `</Table>
</Worksheet>
</Workbook>`;

  return xml;
}

/**
 * Get Excel cell type and value
 */
function getExcelCellData(
  value: unknown,
  type: ColumnType,
  dateFormat?: string
): { cellType: string; cellValue: string; styleId?: string } {
  if (value === null || value === undefined) {
    return { cellType: 'String', cellValue: '' };
  }

  switch (type) {
    case 'number':
    case 'currency':
    case 'percent':
      const num = Number(value);
      if (!isNaN(num)) {
        return {
          cellType: 'Number',
          cellValue: num.toString(),
          styleId: type === 'currency' ? 'Currency' : type === 'percent' ? 'Percent' : undefined,
        };
      }
      return { cellType: 'String', cellValue: String(value) };

    case 'date':
    case 'datetime':
      try {
        const date = new Date(value as string);
        if (!isNaN(date.getTime())) {
          return {
            cellType: 'DateTime',
            cellValue: date.toISOString(),
            styleId: 'Date',
          };
        }
      } catch {
        // Fall through to string
      }
      return { cellType: 'String', cellValue: String(value) };

    case 'boolean':
      return { cellType: 'String', cellValue: value ? 'Yes' : 'No' };

    default:
      return { cellType: 'String', cellValue: String(value) };
  }
}

/**
 * Escape XML special characters
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Export data to Excel
 */
export function exportToExcel(
  data: Record<string, unknown>[],
  columns: string[],
  columnTypes?: Record<string, ColumnType>,
  options?: Partial<ExportOptions>
): ExportResult {
  const xml = convertToExcelXML(data, columns, columnTypes, options);
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
  const filename = options?.filename || `report-${new Date().toISOString().split('T')[0]}.xls`;

  return {
    blob,
    filename,
    mimeType: 'application/vnd.ms-excel',
  };
}

// ============================================================================
// JSON EXPORT
// ============================================================================

/**
 * Export data to JSON
 */
export function exportToJSON(
  data: Record<string, unknown>[],
  columns?: string[],
  options?: Partial<ExportOptions>
): ExportResult {
  // If columns specified, filter data to only include those columns
  const exportData = columns
    ? data.map((row) => {
        const filtered: Record<string, unknown> = {};
        columns.forEach((col) => {
          const key = col.replace('.', '_');
          filtered[key] = row[col] ?? row[key];
        });
        return filtered;
      })
    : data;

  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const filename = options?.filename || `report-${new Date().toISOString().split('T')[0]}.json`;

  return {
    blob,
    filename,
    mimeType: 'application/json',
  };
}

// ============================================================================
// UNIFIED EXPORT FUNCTION
// ============================================================================

/**
 * Export data in the specified format
 */
export function exportData(
  data: Record<string, unknown>[],
  columns: string[],
  format: ExportFormat,
  columnTypes?: Record<string, ColumnType>,
  options?: Partial<ExportOptions>
): ExportResult {
  switch (format) {
    case 'csv':
      return exportToCSV(data, columns, columnTypes, options);
    case 'excel':
      return exportToExcel(data, columns, columnTypes, options);
    case 'json':
      return exportToJSON(data, columns, options);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

/**
 * Trigger browser download
 */
export function downloadExport(result: ExportResult): void {
  const url = URL.createObjectURL(result.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
