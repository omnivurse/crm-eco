/**
 * Module-list URL → query-state resolution, shared by the server list page
 * (`app/crm/modules/[moduleKey]/page.tsx`) and every endpoint that must agree
 * with what that page shows — today the ids-only "Select all N" endpoint
 * (`api/crm/records/ids`). One resolver means a saved view, a `?filters=`
 * override, `?scope=` and `?territory=` are read the same way everywhere, so
 * the pager total, the chip counts and a cross-page selection never drift.
 *
 * Precedence (unchanged from the page's original inline logic):
 *   view    — `?view=` id (if it belongs to the module) → habit-preferred view
 *             for the module → the module's default view → none
 *   sort    — `?sortField=` (+`?sortDirection=`, default asc) → view sort → []
 *   filters — `?filters=` JSON (non-empty array) → view filters → []
 *   scope   — `mine` | `downline` → itself; anything else → `all`
 *
 * Pure and client-safe (no Supabase / next/headers import): the client shell
 * reuses `forwardListUrlQueryParams` so it forwards exactly these keys.
 * `loadListQueryState` takes the two view loaders as arguments so the
 * failure tolerance (a broken view never blanks the list) lives here once.
 */

import type { CrmView, ViewFilter, ViewSort } from './types';
import { parseHabitsProfile } from './habits/types';

export type ListScope = 'all' | 'mine' | 'downline';

/**
 * The list-URL params that decide WHICH rows the list shows. Exactly the set
 * `buildListQuery` in page.tsx writes minus paging/view-mode (`page`,
 * `page_size`, `viewMode`, `treeGroupBy`), which never change the row set.
 */
export const LIST_QUERY_URL_KEYS = [
  'view',
  'search',
  'scope',
  'sortField',
  'sortDirection',
  'filters',
  'territory',
] as const;

export type ListQueryUrlKey = (typeof LIST_QUERY_URL_KEYS)[number];

export type ListUrlQueryState = Partial<Record<ListQueryUrlKey, string | null | undefined>>;

export interface ResolvedListQueryState {
  currentView: CrmView | null;
  filters: ViewFilter[];
  sort: ViewSort[];
  scope: ListScope;
  /** `undefined` when blank so `getRecords` skips the search branch. */
  search: string | undefined;
  territoryId: string | undefined;
}

/** Read the row-set params off a URL (`URLSearchParams` or a plain record). */
export function readListUrlQueryState(
  source: URLSearchParams | Record<string, string | string[] | undefined>,
): ListUrlQueryState {
  const out: ListUrlQueryState = {};
  for (const key of LIST_QUERY_URL_KEYS) {
    const raw =
      source instanceof URLSearchParams
        ? source.get(key)
        : Array.isArray(source[key])
          ? (source[key] as string[])[0]
          : (source[key] as string | undefined);
    if (raw) out[key] = raw;
  }
  return out;
}

/**
 * Copy the row-set params from one list URL onto another query string, exactly
 * as `buildListQuery` writes them (truthy values only, same keys). Used by the
 * client when it asks the server for "the ids of this list".
 */
export function forwardListUrlQueryParams(
  from: URLSearchParams,
  into: URLSearchParams = new URLSearchParams(),
): URLSearchParams {
  for (const key of LIST_QUERY_URL_KEYS) {
    const v = from.get(key);
    if (v) into.set(key, v);
  }
  return into;
}

/** The habit-preferred saved view for a module, if the profile has one. */
export function habitPreferredViewId(
  uiPreferences: unknown,
  moduleKey: string,
): string | null {
  const habits = parseHabitsProfile(
    (uiPreferences as { habits?: unknown } | null | undefined)?.habits,
  );
  const id = habits?.preferred_views?.[moduleKey];
  return typeof id === 'string' && id ? id : null;
}

export function resolveListView(args: {
  views: CrmView[];
  defaultView: CrmView | null;
  viewId?: string | null;
  habitViewId?: string | null;
}): CrmView | null {
  const { views, defaultView, viewId, habitViewId } = args;
  let currentView: CrmView | null = null;
  if (viewId) {
    currentView = views.find((v) => v.id === viewId) || null;
  }
  if (!currentView && habitViewId) {
    currentView = views.find((v) => v.id === habitViewId) || null;
  }
  if (!currentView) {
    currentView = defaultView;
  }
  return currentView;
}

export function resolveListSort(
  currentView: CrmView | null,
  sortField?: string | null,
  sortDirection?: string | null,
): ViewSort[] {
  let sort: ViewSort[] = currentView?.sort || [];
  if (sortField) {
    sort = [{ field: sortField, direction: sortDirection === 'desc' ? 'desc' : 'asc' }];
  }
  return sort;
}

/**
 * Parse a `?filters=` JSON param. Returns `null` when the param is absent,
 * not valid JSON, not an array, or an empty array — every one of those falls
 * back to the view's filters, exactly like the page always did.
 */
export function parseListFiltersParam(filtersParam?: string | null): ViewFilter[] | null {
  if (!filtersParam) return null;
  try {
    const parsed: unknown = JSON.parse(filtersParam);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as ViewFilter[];
    }
  } catch {
    // Invalid JSON, fall back to view filters
  }
  return null;
}

export function resolveListFilters(
  currentView: CrmView | null,
  filtersParam?: string | null,
): ViewFilter[] {
  return parseListFiltersParam(filtersParam) ?? currentView?.filters ?? [];
}

export function normalizeListScope(scope?: string | null): ListScope {
  return scope === 'mine' || scope === 'downline' ? scope : 'all';
}

/** Pure resolution from already-loaded views + the URL state. */
export function resolveListQueryState(args: {
  views: CrmView[];
  defaultView: CrmView | null;
  habitViewId?: string | null;
  url: ListUrlQueryState;
}): ResolvedListQueryState {
  const { views, defaultView, habitViewId, url } = args;
  const currentView = resolveListView({ views, defaultView, viewId: url.view, habitViewId });
  return {
    currentView,
    filters: resolveListFilters(currentView, url.filters),
    sort: resolveListSort(currentView, url.sortField, url.sortDirection),
    scope: normalizeListScope(url.scope),
    search: url.search?.trim() ? url.search : undefined,
    territoryId: url.territory || undefined,
  };
}

/**
 * Load the module's views through the given loaders (the page passes
 * `getViewsForModule` / `getDefaultView` from lib/crm/queries; failures are
 * tolerated exactly as the page does) and resolve the list query state.
 */
export async function loadListQueryState(args: {
  moduleKey: string;
  loadViews: () => Promise<CrmView[]>;
  loadDefaultView: () => Promise<CrmView | null>;
  /** `profiles.ui_preferences` of the viewer (habit-preferred view). */
  uiPreferences?: unknown;
  url: ListUrlQueryState;
}): Promise<ResolvedListQueryState> {
  const { moduleKey, loadViews, loadDefaultView, uiPreferences, url } = args;
  const [viewsResult, defaultViewResult] = await Promise.allSettled([
    loadViews(),
    loadDefaultView(),
  ]);
  const views = viewsResult.status === 'fulfilled' ? viewsResult.value : [];
  const defaultView = defaultViewResult.status === 'fulfilled' ? defaultViewResult.value : null;
  return resolveListQueryState({
    views,
    defaultView,
    habitViewId: habitPreferredViewId(uiPreferences, moduleKey),
    url,
  });
}
