/**
 * Shared helpers for the Zoho-style “Filter {Module} by” rail.
 * Layout only — apply still goes through ViewFilter[] → URL → getRecords.
 */

export type FilterSidebarVariant = 'dialog' | 'docked';

export const FILTER_RAIL_STORAGE_PREFIX = 'crm.filter-rail.';

/** Default open on desktop so the rail is discoverable (Zoho-like). */
export const FILTER_RAIL_DEFAULT_OPEN = true;

export function filterRailStorageKey(moduleKey: string): string {
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

export function readFilterRailOpen(moduleKey: string): boolean {
  if (typeof window === 'undefined') return FILTER_RAIL_DEFAULT_OPEN;
  try {
    const raw = window.localStorage.getItem(filterRailStorageKey(moduleKey));
    if (raw === null) return FILTER_RAIL_DEFAULT_OPEN;
    return raw === '1';
  } catch {
    return FILTER_RAIL_DEFAULT_OPEN;
  }
}

export function writeFilterRailOpen(moduleKey: string, open: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(filterRailStorageKey(moduleKey), open ? '1' : '0');
  } catch {
    /* quota / private mode */
  }
}
