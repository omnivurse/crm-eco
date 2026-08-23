/**
 * TE-5 — Enter pressed in the ⌘K palette while the debounced record search is
 * still in flight (typical: type a phone number, hit Enter straight away).
 *
 * Instead of dropping the keypress, the palette queues it for the query it
 * was pressed on and, when the results land, opens the record ONLY when the
 * answer is unambiguous: exactly one row on screen and that row has at most
 * one module chip (a Contact+Member twin or a shared-phone household must be
 * picked by hand). Any change to the query, or Escape, clears the queue.
 *
 * Pure — no React — so the rule is unit-testable (palette-results.test.ts).
 */

export interface PendingEnterQueueArgs {
  /** The debounced `/api/crm/search` request is still running. */
  searchLoading: boolean;
  /** Raw query text (trimmed inside). */
  query: string;
  /** Rows currently rendered in the palette (records + commands). */
  visibleRowCount: number;
}

/** Minimum query length that triggers the live record search (CommandPalette). */
export const PALETTE_LIVE_SEARCH_MIN = 2;

/** Queue Enter only when there is nothing to act on yet but results are coming. */
export function shouldQueuePaletteEnter({ searchLoading, query, visibleRowCount }: PendingEnterQueueArgs): boolean {
  return searchLoading && query.trim().length >= PALETTE_LIVE_SEARCH_MIN && visibleRowCount === 0;
}

export interface PendingEnterResolveArgs {
  /** The trimmed query Enter was pressed on (`null` = nothing queued). */
  queuedQuery: string | null;
  /** Current raw query text. */
  query: string;
  searchLoading: boolean;
  /** Record rows after grouping — `chipCount` 0/1 = a single record, 2+ = twins. */
  recordRows: ReadonlyArray<{ chipCount: number }>;
  /** All rows rendered (records + matching commands). */
  visibleRowCount: number;
}

export type PendingEnterVerdict = 'wait' | 'open' | 'drop';

/**
 * 'wait' — still loading for the same query, keep the queue.
 * 'open' — results landed, exactly one row, single chip → open it.
 * 'drop' — nothing queued, query moved on, zero or several rows, twins.
 */
export function resolveQueuedPaletteEnter({
  queuedQuery,
  query,
  searchLoading,
  recordRows,
  visibleRowCount,
}: PendingEnterResolveArgs): PendingEnterVerdict {
  if (queuedQuery === null) return 'drop';
  if (query.trim() !== queuedQuery) return 'drop';
  if (searchLoading) return 'wait';
  if (recordRows.length !== 1 || visibleRowCount !== 1) return 'drop';
  return recordRows[0].chipCount <= 1 ? 'open' : 'drop';
}
