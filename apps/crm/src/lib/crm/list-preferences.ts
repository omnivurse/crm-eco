/**
 * Per-module list preferences — "the list looks the same tomorrow as the
 * rep left it".
 *
 * Stored in `profiles.ui_preferences.list_prefs[moduleKey]` (through the
 * existing `/api/crm/ui-preferences` PATCH, which merges top-level keys and
 * passes unknown keys through) with a localStorage mirror for instant
 * hydration before the profile round-trip finishes.
 *
 * Everything here is pure so it can be unit-tested; `useListPreferences`
 * (hooks/useListPreferences.ts) owns the React/side-effect half.
 *
 * Load precedence (resolved by `resolveInitialListState`):
 *   explicit URL params > saved prefs > active crm_view defaults > module default
 */

import type { ViewMode } from './types';
import { VIEW_MODES } from './types';
import { pickDefaultListColumns, type DefaultColumnCandidate } from './default-list-columns';
import { CRM_RECORD_PAGE_SIZES, type CrmRecordPageSize } from './record-list-constants';

export const LIST_PREFS_VERSION = 1 as const;

export type ListPrefScope = 'all' | 'mine' | 'downline';
export type ListPrefSortDirection = 'asc' | 'desc';

export interface ListPrefSort {
  field: string;
  direction: ListPrefSortDirection;
}

/** One module's remembered list shape. Every key is optional — absent = "no opinion". */
export interface ModuleListPrefs {
  v?: typeof LIST_PREFS_VERSION;
  columns?: string[];
  sort?: ListPrefSort | null;
  scope?: ListPrefScope;
  viewMode?: ViewMode;
  /** Rows per page (25 / 50 / 100 — `CRM_RECORD_PAGE_SIZES`); D11: remembered per user/module. */
  pageSize?: CrmRecordPageSize;
  /** ms epoch of the last write — lets the newer of server/local win. */
  updated_at?: number;
}

/** The server default when the URL carries no `?page_size=` (page.tsx `parseCrmRecordPageSize`). */
export const LIST_DEFAULT_PAGE_SIZE: CrmRecordPageSize = 25;

/** `ui_preferences.list_prefs` — keyed by module key. */
export type ListPrefsMap = Record<string, ModuleListPrefs>;

const SCOPES: ReadonlySet<string> = new Set<ListPrefScope>(['all', 'mine', 'downline']);
const DIRECTIONS: ReadonlySet<string> = new Set<ListPrefSortDirection>(['asc', 'desc']);
// `tree` is a valid ViewMode but not in VIEW_MODES (it is promoted per-module).
const VIEW_MODE_SET: ReadonlySet<string> = new Set<string>([...VIEW_MODES, 'tree']);

export const isListPrefScope = (v: unknown): v is ListPrefScope =>
  typeof v === 'string' && SCOPES.has(v);
export const isListPrefDirection = (v: unknown): v is ListPrefSortDirection =>
  typeof v === 'string' && DIRECTIONS.has(v);
export const isListPrefViewMode = (v: unknown): v is ViewMode =>
  typeof v === 'string' && VIEW_MODE_SET.has(v);
export const isListPrefPageSize = (v: unknown): v is CrmRecordPageSize =>
  typeof v === 'number' && (CRM_RECORD_PAGE_SIZES as readonly number[]).includes(v);

/**
 * localStorage key for the per-module mirror, scoped by profile id so user B
 * never hydrates user A's layout on a shared browser. Without a profile id
 * there is no safe key — callers must not read/write the mirror until the
 * viewer is known.
 */
export function listPrefsStorageKey(moduleKey: string, profileId: string): string {
  return `crm:list-prefs:v${LIST_PREFS_VERSION}:u:${profileId}:${moduleKey}`;
}

/**
 * Pre-scoping key (no profile id). Only used to purge stale entries written
 * before the mirror was scoped by user — never read as a hydration source.
 */
export function legacyUnscopedListPrefsStorageKey(moduleKey: string): string {
  return `crm:list-prefs:v${LIST_PREFS_VERSION}:${moduleKey}`;
}

/**
 * Coerce an untrusted blob (server JSONB, localStorage, older shapes) into a
 * well-formed `ModuleListPrefs`. Drops anything it does not understand
 * instead of throwing, so a bad row never breaks the list. Returns `null`
 * when nothing usable is left.
 */
export function sanitizeListPrefs(raw: unknown): ModuleListPrefs | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const out: ModuleListPrefs = {};

  if (Array.isArray(obj.columns)) {
    const cols = dedupe(obj.columns.filter((c): c is string => typeof c === 'string' && c.length > 0));
    if (cols.length > 0) out.columns = cols;
  }

  if (obj.sort === null) {
    out.sort = null;
  } else if (obj.sort && typeof obj.sort === 'object') {
    const s = obj.sort as Record<string, unknown>;
    if (typeof s.field === 'string' && s.field) {
      out.sort = { field: s.field, direction: isListPrefDirection(s.direction) ? s.direction : 'asc' };
    }
  }

  if (isListPrefScope(obj.scope)) out.scope = obj.scope;
  if (isListPrefViewMode(obj.viewMode)) out.viewMode = obj.viewMode;
  if (isListPrefPageSize(obj.pageSize)) out.pageSize = obj.pageSize;
  if (typeof obj.updated_at === 'number' && Number.isFinite(obj.updated_at)) out.updated_at = obj.updated_at;

  if (Object.keys(out).filter((k) => k !== 'updated_at').length === 0) return null;
  out.v = LIST_PREFS_VERSION;
  return out;
}

/** Sanitize a whole `list_prefs` map (unknown module keys are kept). */
export function sanitizeListPrefsMap(raw: unknown): ListPrefsMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: ListPrefsMap = {};
  for (const [moduleKey, value] of Object.entries(raw as Record<string, unknown>)) {
    const clean = sanitizeListPrefs(value);
    if (clean) out[moduleKey] = clean;
  }
  return out;
}

/**
 * Drop column / sort keys that no longer exist on the module (fields get
 * renamed and deleted; a stale pref must degrade to defaults, not to an
 * empty table). Returns the same object when nothing changed.
 */
export function validateListPrefsAgainstFields(
  prefs: ModuleListPrefs | null | undefined,
  fields: ReadonlyArray<{ key: string }>,
): ModuleListPrefs | null {
  if (!prefs) return null;
  const known = new Set(fields.map((f) => f.key));
  let next: ModuleListPrefs = prefs;
  if (prefs.columns) {
    const cols = prefs.columns.filter((c) => known.has(c));
    if (cols.length !== prefs.columns.length) {
      next = { ...next };
      if (cols.length > 0) next.columns = cols;
      else delete next.columns;
    }
  }
  if (prefs.sort && !known.has(prefs.sort.field)) {
    next = next === prefs ? { ...next } : next;
    delete next.sort;
  }
  return next;
}

/**
 * Merge a partial change into existing prefs. `null` sort means "explicitly
 * no sort" (kept), `undefined` means "leave as-is". Stamps `updated_at`.
 */
export function mergeListPrefs(
  existing: ModuleListPrefs | null | undefined,
  patch: Partial<Omit<ModuleListPrefs, 'v' | 'updated_at'>>,
  now: number = Date.now(),
): ModuleListPrefs {
  const next: ModuleListPrefs = { ...(existing ?? {}) };
  if (patch.columns !== undefined) next.columns = dedupe(patch.columns.filter(Boolean));
  if (patch.sort !== undefined) next.sort = patch.sort;
  if (patch.scope !== undefined) next.scope = patch.scope;
  if (patch.viewMode !== undefined) next.viewMode = patch.viewMode;
  if (patch.pageSize !== undefined) next.pageSize = patch.pageSize;
  next.v = LIST_PREFS_VERSION;
  next.updated_at = now;
  return next;
}

/** Newer write wins; falls back to server when timestamps are absent/equal. */
export function pickNewerListPrefs(
  server: ModuleListPrefs | null | undefined,
  local: ModuleListPrefs | null | undefined,
): ModuleListPrefs | null {
  if (!server) return local ?? null;
  if (!local) return server;
  const s = server.updated_at ?? 0;
  const l = local.updated_at ?? 0;
  return l > s ? local : server;
}

/** Shallow structural equality (order-sensitive for columns, as it should be). */
export function listPrefsEqual(a: ModuleListPrefs | null | undefined, b: ModuleListPrefs | null | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    sameArray(a.columns, b.columns) &&
    sameSort(a.sort, b.sort) &&
    (a.scope ?? undefined) === (b.scope ?? undefined) &&
    (a.viewMode ?? undefined) === (b.viewMode ?? undefined) &&
    (a.pageSize ?? undefined) === (b.pageSize ?? undefined)
  );
}

// ============================================================================
// Initial state resolution
// ============================================================================

export interface ListUrlState {
  /** `?view=` present → the user (or a link) explicitly picked a crm_view. */
  viewId: string | null;
  sortField: string | null;
  sortDirection: ListPrefSortDirection | null;
  scope: ListPrefScope | null;
  viewMode: ViewMode | null;
  /** `?page_size=` when it is one of the allowed sizes. */
  pageSize: CrmRecordPageSize | null;
}

/** Minimal read-only shape shared by URLSearchParams and Next's ReadonlyURLSearchParams. */
export interface ParamsLike {
  get(name: string): string | null;
}

/** Read the pref-managed keys from the URL, ignoring malformed values. */
export function readListUrlState(params: ParamsLike | null | undefined): ListUrlState {
  const get = (k: string) => params?.get(k) ?? null;
  const dir = get('sortDirection');
  const scope = get('scope');
  const vm = get('viewMode');
  const sizeRaw = get('page_size');
  const size = sizeRaw ? Number.parseInt(sizeRaw, 10) : NaN;
  return {
    viewId: get('view') || null,
    sortField: get('sortField') || null,
    sortDirection: isListPrefDirection(dir) ? dir : null,
    scope: isListPrefScope(scope) ? scope : null,
    viewMode: isListPrefViewMode(vm) ? vm : null,
    pageSize: isListPrefPageSize(size) ? size : null,
  };
}

export interface ActiveViewLike {
  id: string;
  columns?: string[] | null;
  sort?: Array<{ field: string; direction: ListPrefSortDirection }> | null;
}

export interface ResolvedListState {
  columns: string[];
  sort: ListPrefSort | null;
  scope: ListPrefScope;
  viewMode: ViewMode;
  pageSize: CrmRecordPageSize;
  /**
   * URL params that must be added so the server (which only reads the URL)
   * renders the remembered shape. Empty when the URL already says it all or
   * the remembered value equals the default. Never contains keys already in
   * the URL — explicit URL always wins.
   */
  urlPatch: Partial<Record<'sortField' | 'sortDirection' | 'scope' | 'viewMode' | 'page_size', string>>;
  /** Where each piece came from — handy for tests and debugging. */
  source: {
    columns: 'url-view' | 'prefs' | 'view' | 'default';
    sort: 'url' | 'url-view' | 'prefs' | 'view' | 'none';
    scope: 'url' | 'prefs' | 'default';
    viewMode: 'url' | 'prefs' | 'default';
    pageSize: 'url' | 'prefs' | 'default';
  };
}

/**
 * Decide the list's initial shape.
 *
 * - URL keys always win (`?sortField=`, `?scope=`, `?viewMode=`).
 * - An explicit `?view=` means the user just picked a crm_view: its columns
 *   and sort win over remembered prefs (the view IS the pref then).
 * - Otherwise remembered prefs beat the module's default crm_view, which
 *   beats `pickDefaultListColumns`.
 *
 * `urlPatch` lists the params the caller should `router.replace` in so the
 * server-side query (sort/scope/viewMode live only in the URL) matches.
 */
export function resolveInitialListState(input: {
  url: ListUrlState;
  prefs: ModuleListPrefs | null | undefined;
  activeView: ActiveViewLike | null | undefined;
  fields: ReadonlyArray<DefaultColumnCandidate>;
}): ResolvedListState {
  const { url, activeView } = input;
  const prefs = validateListPrefsAgainstFields(input.prefs, input.fields);
  const explicitView = Boolean(url.viewId && activeView && activeView.id === url.viewId);
  const viewColumns = activeView?.columns && activeView.columns.length > 0 ? activeView.columns : null;
  const viewSort = activeView?.sort && activeView.sort.length > 0 ? activeView.sort[0] : null;
  const urlPatch: ResolvedListState['urlPatch'] = {};

  // Columns
  let columns: string[];
  let columnsSource: ResolvedListState['source']['columns'];
  if (explicitView && viewColumns) {
    columns = viewColumns; columnsSource = 'url-view';
  } else if (prefs?.columns && prefs.columns.length > 0) {
    columns = prefs.columns; columnsSource = 'prefs';
  } else if (viewColumns) {
    columns = viewColumns; columnsSource = 'view';
  } else {
    columns = pickDefaultListColumns(input.fields); columnsSource = 'default';
  }

  // Sort
  let sort: ListPrefSort | null = null;
  let sortSource: ResolvedListState['source']['sort'] = 'none';
  if (url.sortField) {
    sort = { field: url.sortField, direction: url.sortDirection ?? 'asc' }; sortSource = 'url';
  } else if (explicitView && viewSort) {
    sort = { field: viewSort.field, direction: viewSort.direction }; sortSource = 'url-view';
  } else if (prefs && prefs.sort !== undefined) {
    if (prefs.sort) {
      sort = { ...prefs.sort }; sortSource = 'prefs';
      urlPatch.sortField = sort.field;
      urlPatch.sortDirection = sort.direction;
    }
  } else if (viewSort) {
    sort = { field: viewSort.field, direction: viewSort.direction }; sortSource = 'view';
  }

  // Scope
  let scope: ListPrefScope = 'all';
  let scopeSource: ResolvedListState['source']['scope'] = 'default';
  if (url.scope) {
    scope = url.scope; scopeSource = 'url';
  } else if (prefs?.scope) {
    scope = prefs.scope; scopeSource = 'prefs';
    if (scope !== 'all') urlPatch.scope = scope;
  }

  // View mode
  let viewMode: ViewMode = 'table';
  let viewModeSource: ResolvedListState['source']['viewMode'] = 'default';
  if (url.viewMode) {
    viewMode = url.viewMode; viewModeSource = 'url';
  } else if (prefs?.viewMode) {
    viewMode = prefs.viewMode; viewModeSource = 'prefs';
    if (viewMode !== 'table') urlPatch.viewMode = viewMode;
  }

  // Page size (D11: remembered per user/module; URL > prefs > 25)
  let pageSize: CrmRecordPageSize = LIST_DEFAULT_PAGE_SIZE;
  let pageSizeSource: ResolvedListState['source']['pageSize'] = 'default';
  if (url.pageSize) {
    pageSize = url.pageSize; pageSizeSource = 'url';
  } else if (prefs?.pageSize) {
    pageSize = prefs.pageSize; pageSizeSource = 'prefs';
    if (pageSize !== LIST_DEFAULT_PAGE_SIZE) urlPatch.page_size = String(pageSize);
  }

  return {
    columns,
    sort,
    scope,
    viewMode,
    pageSize,
    urlPatch,
    source: { columns: columnsSource, sort: sortSource, scope: scopeSource, viewMode: viewModeSource, pageSize: pageSizeSource },
  };
}

/** Apply `urlPatch` to a copy of the current params (never overwrites existing keys). */
export function applyListUrlPatch(
  params: ParamsLike & { toString(): string },
  patch: ResolvedListState['urlPatch'],
): URLSearchParams | null {
  const next = new URLSearchParams(params.toString());
  let changed = false;
  for (const [k, v] of Object.entries(patch)) {
    if (!v || next.has(k)) continue;
    next.set(k, v);
    changed = true;
  }
  return changed ? next : null;
}

// ============================================================================
// helpers
// ============================================================================

function dedupe(list: string[]): string[] {
  return Array.from(new Set(list));
}

function sameArray(a?: string[] | null, b?: string[] | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function sameSort(a?: ListPrefSort | null, b?: ListPrefSort | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.field === b.field && a.direction === b.direction;
}
