/**
 * Shared helpers for the Zoho-style “Filter {Module} by” rail.
 * Layout only — apply still goes through ViewFilter[] → URL → getRecords.
 *
 * The open/collapsed state is remembered per module AND per viewer
 * (profile id) so a second user on the same browser gets the default rail,
 * not the previous user's layout — same scoping rule as the list-prefs
 * mirror (lib/crm/list-preferences.ts `listPrefsStorageKey`). Without a
 * viewer id nothing is read or written (fail closed: default open).
 *
 * Reads go through a tiny external store (`subscribeFilterRailOpen` +
 * `readFilterRailOpen`) so ModuleShell can `useSyncExternalStore` the stored
 * value during hydration — no open-then-snap flash on first paint.
 */

export type FilterSidebarVariant = 'dialog' | 'docked';

export const FILTER_RAIL_STORAGE_PREFIX = 'crm.filter-rail.';

/** Default open on desktop so the rail is discoverable (Zoho-like). */
export const FILTER_RAIL_DEFAULT_OPEN = true;

export function applyFilterButtonLabel(
  variant: FilterSidebarVariant,
  readyCount = 0,
): string {
  const suffix = readyCount > 0 ? ` (${readyCount})` : '';
  return variant === 'docked' ? `Apply Filter${suffix}` : `Apply${suffix}`;
}

/**
 * Viewer-scoped storage key. `profileId` is required — the legacy unscoped
 * key (`crm.filter-rail.{module}`) is only ever purged, never read.
 */
export function filterRailStorageKey(moduleKey: string, profileId: string): string {
  return `${FILTER_RAIL_STORAGE_PREFIX}u:${profileId.trim()}:${moduleKey.trim()}`;
}

/** Pre-scoping key (no viewer) — purge target only. */
export function legacyFilterRailStorageKey(moduleKey: string): string {
  return `${FILTER_RAIL_STORAGE_PREFIX}${moduleKey.trim()}`;
}

export function filterModuleByTitle(moduleName: string): string {
  const name = moduleName.trim() || 'Records';
  return `Filter ${name} by`;
}

export function moduleFilterRailTitle(module: {
  name?: string | null;
  name_plural?: string | null;
  key?: string | null;
}): string {
  const name = (module.name_plural || module.name || module.key || 'Records').trim();
  return filterModuleByTitle(name);
}

/** Dialog hosts close after Apply; a docked rail stays mounted. */
export function shouldCloseFilterHost(variant: FilterSidebarVariant): boolean {
  return variant !== 'docked';
}

/** Pure decode of a stored value (`'1'` / `'0'`); anything else → default. */
export function parseFilterRailOpen(raw: string | null | undefined): boolean {
  if (raw === '1') return true;
  if (raw === '0') return false;
  return FILTER_RAIL_DEFAULT_OPEN;
}

export function readFilterRailOpen(moduleKey: string, profileId?: string | null): boolean {
  if (typeof window === 'undefined' || !profileId) return FILTER_RAIL_DEFAULT_OPEN;
  try {
    return parseFilterRailOpen(window.localStorage.getItem(filterRailStorageKey(moduleKey, profileId)));
  } catch {
    return FILTER_RAIL_DEFAULT_OPEN;
  }
}

const listeners = new Set<() => void>();

/** Subscribe to rail-state writes (this tab + the `storage` event from others). */
export function subscribeFilterRailOpen(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window !== 'undefined') window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    if (typeof window !== 'undefined') window.removeEventListener('storage', listener);
  };
}

export function writeFilterRailOpen(
  moduleKey: string,
  open: boolean,
  profileId?: string | null,
): void {
  if (typeof window === 'undefined' || !profileId) return;
  try {
    window.localStorage.setItem(filterRailStorageKey(moduleKey, profileId), open ? '1' : '0');
  } catch {
    /* quota / private mode */
  }
  listeners.forEach((l) => l());
}

/**
 * LS-8: does a rail keydown target sit inside chrome that owns its own
 * Enter/Escape (an open Radix dropdown/popover or a dialog)? The rail's
 * accordion sections also carry `data-state="open"`, so a bare data-state
 * check swallowed EVERY Escape typed in a value input — the guard is
 * popper/dialog-specific instead.
 */
export function railKeyTargetInOwnKeyScope(target: Element): boolean {
  if (target.closest('[role="listbox"], [role="dialog"], [data-radix-popper-content-wrapper]')) return true;
  if (target.getAttribute('aria-expanded') === 'true') return true;
  return false;
}

/**
 * One-time hygiene: the pre-scoping key cannot be attributed to a viewer, so
 * it is never read — only removed.
 */
export function purgeLegacyFilterRailKey(moduleKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(legacyFilterRailStorageKey(moduleKey));
  } catch {
    /* ignore */
  }
}
