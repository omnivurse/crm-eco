/**
 * Paged reads for import duplicate-detection lookups.
 *
 * PostgREST caps an unbounded SELECT at `db.max_rows` (1000 for this project —
 * see supabase/config.toml) and it does so SILENTLY: a truncated response is a
 * 206 with rows, not an error. Any dedup scan written as a plain
 * `.select().eq(...)` therefore built its lookup map from the first 1000 rows
 * only, and every duplicate beyond that window was let through as a fresh
 * insert.
 *
 * That is invisible until a module crosses 1000 records, at which point imports
 * start silently creating duplicates.
 */

/** Must match (or be below) the PostgREST `db.max_rows` for the project. */
export const DEDUP_PAGE_SIZE = 1000;

export interface PagedResult<T> {
  data: T[] | null;
  error: { message: string; code?: string } | null;
}

/**
 * Carries the PostgREST error `code` through, so callers can keep tolerating
 * specific ones (e.g. PGRST204 "column not found in schema cache" when a module
 * has no `zoho_id`) without resorting to message matching.
 */
export class DedupLookupError extends Error {
  readonly code?: string;

  constructor(label: string, message: string, code?: string) {
    super(`Import dedup lookup (${label}) failed: ${message}`);
    this.name = 'DedupLookupError';
    this.code = code;
  }
}

/**
 * Read every row of a lookup, one page at a time.
 *
 * `fetchPage` receives an inclusive `[from, to]` range and must issue a FRESH
 * query on each call — Supabase query builders are single-use — ordered by a
 * unique column (`id`) so page boundaries are stable. Without a total order
 * `.range()` can skip or repeat rows between pages, and a *wrong* dedup map is
 * considerably harder to notice than a missing one.
 *
 * Throws rather than returning partial data: a half-built dedup map is
 * indistinguishable from "no duplicates found", which is precisely the failure
 * this function exists to prevent. Callers should let the import fail rather
 * than insert rows they could not check.
 */
export async function fetchAllForDedup<T>(
  label: string,
  fetchPage: (from: number, to: number) => PromiseLike<PagedResult<T>>,
): Promise<T[]> {
  const all: T[] = [];

  for (let from = 0; ; from += DEDUP_PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + DEDUP_PAGE_SIZE - 1);

    if (error) {
      throw new DedupLookupError(label, error.message, error.code);
    }

    const page = data ?? [];
    all.push(...page);

    // A short page means the end of the result set; a full page means there may
    // be more.
    if (page.length < DEDUP_PAGE_SIZE) return all;
  }
}
