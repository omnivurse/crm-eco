/**
 * Filter-aware empty states for CRM lists (RecordTable / ListView).
 *
 * The list is URL-driven (`?search=`, `?filters=`, `?scope=`, `?territory=`,
 * `?view=`, `?page=`), so both views can tell *why* zero rows came back by
 * reading the same query state ModuleShell writes. This module is pure so
 * the copy/decision logic is unit-tested; the components only render it.
 *
 * "Create your first record" must only ever show when the module truly has
 * zero records — never to a 14k-record search that happened to miss.
 */

export type ListScope = 'all' | 'mine' | 'downline';

export interface ListQueryState {
  search: string;
  /** Number of valid `?filters=` entries (0 when absent / unparsable). */
  filterCount: number;
  scope: ListScope;
  territory: string | null;
  /** Explicit `?view=` saved view (its own filters apply server-side). */
  viewId: string | null;
  /** 1-based page (defaults to 1). */
  page: number;
}

/** Minimal read-only shape shared by URLSearchParams and Next's ReadonlyURLSearchParams. */
export interface ParamsLike {
  get(name: string): string | null;
}

const SCOPES: ReadonlySet<string> = new Set(['all', 'mine', 'downline']);

function countValidFilters(raw: string | null): number {
  if (!raw) return 0;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return 0;
    return parsed.filter(
      (f) =>
        f && typeof f === 'object' &&
        typeof (f as { field?: unknown }).field === 'string' &&
        typeof (f as { operator?: unknown }).operator === 'string',
    ).length;
  } catch {
    return 0;
  }
}

/** Read the list's narrowing state straight from the URL. */
export function readListQueryState(params: ParamsLike | null | undefined): ListQueryState {
  const get = (k: string) => params?.get(k) ?? null;
  const scopeRaw = get('scope');
  const pageRaw = Number.parseInt(get('page') ?? '', 10);
  return {
    search: (get('search') ?? '').trim(),
    filterCount: countValidFilters(get('filters')),
    scope: scopeRaw && SCOPES.has(scopeRaw) ? (scopeRaw as ListScope) : 'all',
    territory: get('territory') || null,
    viewId: get('view') || null,
    page: Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1,
  };
}

/** True when anything is narrowing the list beyond "every record in the module". */
export function isListNarrowed(q: ListQueryState): boolean {
  return (
    q.search.length > 0 ||
    q.filterCount > 0 ||
    q.scope !== 'all' ||
    q.territory !== null ||
    q.viewId !== null
  );
}

const SCOPE_LABEL: Record<ListScope, string> = {
  all: 'all records',
  mine: 'My Records',
  downline: 'My Downline',
};

/**
 * Human summary of what is narrowing the list, e.g.
 * `search "smith", 2 filters and My Records`.
 */
export function summarizeListQuery(q: ListQueryState): string {
  const parts: string[] = [];
  if (q.search) parts.push(`search "${q.search}"`);
  if (q.filterCount > 0) parts.push(`${q.filterCount} filter${q.filterCount === 1 ? '' : 's'}`);
  if (q.viewId) parts.push('this saved view');
  if (q.scope !== 'all') parts.push(SCOPE_LABEL[q.scope]);
  if (q.territory) parts.push('this territory');
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

export type ClearListStateTarget =
  | 'filters'
  | 'search'
  | 'scope'
  | 'territory'
  | 'view'
  | 'page'
  | 'all'
  /** Re-run the server load after a failed fetch (router.refresh, URL unchanged). */
  | 'retry';

export interface ListEmptyAction {
  id: ClearListStateTarget;
  label: string;
}

export type ListEmptyReason = 'no-records' | 'no-match' | 'page-out-of-range' | 'load-failed';

export interface ListEmptyState {
  reason: ListEmptyReason;
  title: string;
  description: string;
  /** Clear buttons to render (empty for the true-empty case). */
  actions: ListEmptyAction[];
  /** Only true when the module genuinely has nothing to show. */
  showCreateImport: boolean;
}

/** Turn a module key like `health_insurance` into a plural noun for copy. */
export function recordNounFromModuleKey(moduleKey: string | null | undefined): string {
  const cleaned = (moduleKey ?? '').replace(/[-_]+/g, ' ').trim().toLowerCase();
  return cleaned || 'records';
}

/**
 * Decide which empty state to show. Returns `null` when there are rows.
 *
 * `totalCount` (the filtered total from the server) is optional — a
 * positive value with zero rows means the page is out of range.
 */
export function resolveListEmptyState(input: {
  recordCount: number;
  totalCount?: number | null;
  query: ListQueryState;
  recordNoun?: string;
  /**
   * The server could not load the rows at all (query threw). Zero rows then
   * means "unknown", not "empty" — never show the Create CTA or a clear-filter
   * hint; offer a retry instead.
   */
  loadError?: boolean;
}): ListEmptyState | null {
  const { recordCount, totalCount, query } = input;
  if (recordCount > 0) return null;
  const noun = input.recordNoun || 'records';

  if (input.loadError) {
    return {
      reason: 'load-failed',
      title: `Couldn't load ${noun}`,
      description: 'Something went wrong while loading this list. Your filters are unchanged — try again in a moment.',
      actions: [{ id: 'retry', label: 'Try again' }],
      showCreateImport: false,
    };
  }

  if ((totalCount ?? 0) > 0 || (query.page > 1 && !isListNarrowed(query))) {
    return {
      reason: 'page-out-of-range',
      title: `Nothing on page ${query.page}`,
      description: `This page is past the end of the list. Go back to the first page to see your ${noun}.`,
      actions: [{ id: 'page', label: 'Go to first page' }],
      showCreateImport: false,
    };
  }

  if (isListNarrowed(query)) {
    const actions: ListEmptyAction[] = [];
    if (query.filterCount > 0) actions.push({ id: 'filters', label: 'Clear filters' });
    if (query.search) actions.push({ id: 'search', label: 'Clear search' });
    if (query.viewId) actions.push({ id: 'view', label: 'Leave saved view' });
    if (query.scope !== 'all') actions.push({ id: 'scope', label: 'Show all records' });
    if (query.territory) actions.push({ id: 'territory', label: 'Clear territory' });
    if (actions.length > 1) actions.push({ id: 'all', label: 'Clear everything' });
    return {
      reason: 'no-match',
      title: `No ${noun} match ${summarizeListQuery(query)}`,
      description: query.page > 1
        ? 'This page is empty and nothing else matches. Widen the search or clear a filter to see more.'
        : 'Try a broader search, remove a filter, or check the spelling.',
      actions,
      showCreateImport: false,
    };
  }

  return {
    reason: 'no-records',
    title: `No ${noun} yet`,
    description: 'Get started by creating a new record or importing data.',
    actions: [],
    showCreateImport: true,
  };
}

// ============================================================================
// Clear-request bus — the empty state lives inside RecordTable/ListView, but
// list state (filters/search/scope) is owned by ModuleShell. Same window-event
// pattern as `CRM_COLUMN_WIDTHS_RESET_EVENT` so the existing clear handlers
// stay the single write path to the URL.
// ============================================================================

export const CRM_CLEAR_LIST_STATE_EVENT = 'crm:clear-list-state' as const;

export interface ClearListStateDetail {
  moduleKey: string;
  target: ClearListStateTarget;
}

export function requestClearListState(detail: ClearListStateDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<ClearListStateDetail>(CRM_CLEAR_LIST_STATE_EVENT, { detail }),
  );
}

/**
 * Pure URL rewrite for a clear target. Returns a *new* URLSearchParams so the
 * caller can push it; every clear also resets paging.
 */
export function clearListStateParams(
  params: ParamsLike & { toString(): string },
  target: ClearListStateTarget,
): URLSearchParams {
  const next = new URLSearchParams(params.toString());
  const drop = (...keys: string[]) => keys.forEach((k) => next.delete(k));
  switch (target) {
    case 'filters': drop('filters'); break;
    case 'search': drop('search'); break;
    case 'scope': drop('scope'); break;
    case 'territory': drop('territory'); break;
    case 'view': drop('view'); break;
    case 'page': break;
    case 'all': drop('filters', 'search', 'scope', 'territory', 'view'); break;
    // A retry re-runs the same query: keep the URL (including the page) as is.
    case 'retry': return next;
  }
  next.delete('page');
  return next;
}

/**
 * Pure URL rewrite for keyboard paging (PageUp / PageDown on the grid).
 * Returns the params for page `current + delta`, or `null` when that page
 * does not exist (already on the first / last page) so callers do nothing.
 * `total` is the filtered total the server reported; page size comes from
 * `?page_size=` (default 25, the list's server default).
 */
export function stepListPageParams(
  params: ParamsLike & { toString(): string },
  delta: number,
  total: number | null | undefined,
): URLSearchParams | null {
  const current = readListQueryState(params).page;
  const sizeRaw = Number.parseInt(params.get('page_size') ?? '', 10);
  const pageSize = Number.isFinite(sizeRaw) && sizeRaw > 0 ? sizeRaw : 25;
  const lastPage = Math.max(1, Math.ceil((total ?? 0) / pageSize));
  const target = current + delta;
  if (target < 1 || target > lastPage || target === current) return null;
  const next = new URLSearchParams(params.toString());
  next.set('page', String(target));
  return next;
}
