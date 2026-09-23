import type { DataSource, ListQuery } from './types';

/** Keep export requests below Supabase's default 1,000-row response limit. */
export const EXPORT_BATCH_SIZE = 500;

export type ExportListQuery = Omit<ListQuery, 'page' | 'pageSize'>;

/**
 * Loads the complete filtered result set in bounded pages for client-side export.
 *
 * The first response's exact total is treated as the export snapshot boundary.
 * An empty page terminates early so a stale count cannot cause an infinite loop.
 */
export async function loadAllRows<Row>(
  dataSource: DataSource<Row>,
  query: ExportListQuery,
  batchSize = EXPORT_BATCH_SIZE,
): Promise<Row[]> {
  if (!Number.isSafeInteger(batchSize) || batchSize <= 0) {
    throw new Error('Export batch size must be a positive integer');
  }

  const rows: Row[] = [];
  let page = 1;
  let expectedTotal: number | null = null;

  while (expectedTotal === null || rows.length < expectedTotal) {
    const result = await dataSource.load({
      ...query,
      page,
      pageSize: batchSize,
    });

    if (expectedTotal === null) {
      if (!Number.isSafeInteger(result.total) || result.total < 0) {
        throw new Error('Export data source returned an invalid total');
      }
      expectedTotal = result.total;
    }

    rows.push(...result.rows);
    if (result.rows.length === 0) break;
    page += 1;
  }

  return rows;
}
