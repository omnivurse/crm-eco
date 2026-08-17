/**
 * Tenant navigation profiles — pure helpers, safe for client bundles.
 *
 * `simple`  → a small org (e.g. a 3-person health-share) sees ~8–10 links:
 *             Dashboard, Workqueue, the org's ENABLED people modules from
 *             `crm_modules` (display_order), then Tasks, Calendar, Reports,
 *             Inbox. No top module tabs.
 * `full`    → the classic Zoho-style tab bar + contextual sidebar, except the
 *             "Sales Pipeline" / "Advisors" links are driven by `crm_modules`
 *             so disabled or field-less modules never appear.
 *
 * Nothing in here touches the DB or `next/*` — the server layout resolves the
 * profile via the `crm.nav.simple` feature flag and hands the result down.
 */

import type { NavItem } from '@/contexts/ModuleContext';

export type NavProfile = 'simple' | 'full';

/** The `crm_feature_flags.flag_key` that switches an org onto the simple profile. */
export const CRM_NAV_SIMPLE_FLAG = 'crm.nav.simple' as const;

/** Minimal module shape needed to build navigation (subset of `CrmModule`). */
export interface NavModule {
  key: string;
  name: string;
  name_plural: string | null;
  icon?: string | null;
  is_enabled: boolean;
  display_order: number;
  /** Number of `crm_fields` rows; `undefined` = unknown (never hides a module). */
  field_count?: number;
}

/** Sidebar icon per well-known module key; falls back to `crm_modules.icon`. */
const MODULE_ICON_BY_KEY: Record<string, string> = {
  leads: 'user-plus',
  contacts: 'users',
  members: 'shield-check',
  advisors: 'user-cog',
  accounts: 'building',
  deals: 'dollar-sign',
  prospects: 'target',
};

/**
 * Modules a nav may link to: enabled, and — when the field count is known —
 * at least one field (a 0-field module can't render a form or a list).
 */
export function isNavigableModule(m: NavModule): boolean {
  if (m.is_enabled === false) return false;
  if (typeof m.field_count === 'number' && m.field_count <= 0) return false;
  return true;
}

/** Enabled, navigable modules sorted by `display_order` (stable on key). */
export function navigableModules(modules: readonly NavModule[]): NavModule[] {
  return modules
    .filter(isNavigableModule)
    .slice()
    .sort((a, b) => (a.display_order - b.display_order) || a.key.localeCompare(b.key));
}

export function moduleHref(key: string): string {
  return `/crm/modules/${encodeURIComponent(key)}`;
}

export function moduleNavLabel(m: NavModule): string {
  return (m.name_plural && m.name_plural.trim()) || m.name || m.key;
}

export function moduleNavIcon(m: NavModule): string {
  return MODULE_ICON_BY_KEY[m.key] || (m.icon && m.icon.trim()) || 'file-text';
}

export function moduleNavItem(m: NavModule): NavItem {
  return {
    key: `module-${m.key}`,
    label: moduleNavLabel(m),
    icon: moduleNavIcon(m),
    href: moduleHref(m.key),
  };
}

// ---------------------------------------------------------------------------
// Simple profile
// ---------------------------------------------------------------------------

/**
 * Dashboard, Workqueue, <enabled modules>, Tasks, Calendar, Reports, Inbox.
 * Settings is reachable via the gear icon in the top bar (desktop) and the
 * mobile drawer footer, so it is intentionally not repeated here.
 */
export function buildSimpleNav(modules: readonly NavModule[]): NavItem[] {
  return [
    { key: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', href: '/crm' },
    { key: 'workqueue', label: 'Workqueue', icon: 'inbox', href: '/crm/workqueue' },
    ...navigableModules(modules).map(moduleNavItem),
    { key: 'tasks', label: 'Tasks', icon: 'check-square', href: '/crm/tasks' },
    { key: 'calendar', label: 'Calendar', icon: 'calendar', href: '/crm/calendar' },
    { key: 'reports', label: 'Reports', icon: 'pie-chart', href: '/crm/reports' },
    { key: 'inbox', label: 'Inbox', icon: 'inbox', href: '/crm/inbox' },
  ];
}

// ---------------------------------------------------------------------------
// Full profile — module-driven "Sales Pipeline" + Advisors
// ---------------------------------------------------------------------------

/** Keys inside the static "Sales Pipeline" section that are module list links. */
const PIPELINE_MODULE_KEYS = new Set(['leads', 'contacts', 'accounts', 'members']);

/**
 * Take the static CRM nav and:
 *  - replace the hard-coded module links in "Sales Pipeline" with the org's
 *    enabled modules (display_order; `advisors` is kept in People Management),
 *  - keep the `advisors` link only when the `advisors` module is enabled.
 * Every other item passes through untouched.
 */
export function buildFullCrmNav(base: readonly NavItem[], modules: readonly NavModule[]): NavItem[] {
  const navigable = navigableModules(modules);
  const advisorsEnabled = navigable.some((m) => m.key === 'advisors');
  const pipelineItems = navigable
    .filter((m) => m.key !== 'advisors')
    .map(moduleNavItem);

  const out: NavItem[] = [];
  let injected = false;
  for (const item of base) {
    if (item.separator) {
      out.push(item);
      if (item.key === 'sec-pipeline') {
        out.push(...pipelineItems);
        injected = true;
      }
      continue;
    }
    if (item.key === 'advisors' && !advisorsEnabled) continue;
    if (injected && PIPELINE_MODULE_KEYS.has(item.key)) continue;
    out.push(item);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Active-state matching (pathname + query)
// ---------------------------------------------------------------------------

function splitHref(href: string): { path: string; params: URLSearchParams } {
  const qIdx = href.indexOf('?');
  const path = (qIdx === -1 ? href : href.slice(0, qIdx)).replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(qIdx === -1 ? '' : href.slice(qIdx + 1));
  return { path, params };
}

function toSearchParams(search: string | URLSearchParams | null | undefined): URLSearchParams {
  if (!search) return new URLSearchParams();
  if (typeof search === 'string') return new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return search;
}

/**
 * Does the current location match `href`?
 *  - Path: exact, or a descendant (`/crm/vendors` matches `/crm/vendors/upload`);
 *    `/crm` (dashboard) is exact-only.
 *  - Query: every param in the href must be present with the same value in the
 *    current search (extra current params are fine).
 */
export function isNavHrefActive(
  href: string,
  pathname: string,
  search?: string | URLSearchParams | null,
): boolean {
  const { path, params } = splitHref(href);
  const current = (pathname || '/').replace(/\/+$/, '') || '/';
  const pathMatches = path === '/crm'
    ? current === '/crm'
    : current === path || current.startsWith(path + '/');
  if (!pathMatches) return false;
  const currentParams = toSearchParams(search);
  for (const [k, v] of params) {
    if (currentParams.get(k) !== v) return false;
  }
  return true;
}

/**
 * Pick the single nav item that should be highlighted: the deepest matching
 * path, and among equal paths the one whose query matched the most params.
 * So `/crm/modules/contacts?tab=groups` highlights "Contact Groups" and NOT
 * its parent "Contacts"; `/crm/vendors/upload` highlights "Upload Files" only.
 */
export function resolveActiveNavKey(
  items: readonly NavItem[],
  pathname: string,
  search?: string | URLSearchParams | null,
): string | null {
  let bestKey: string | null = null;
  let bestPathLen = -1;
  let bestParamCount = -1;
  for (const item of items) {
    if (item.separator || !item.href) continue;
    if (!isNavHrefActive(item.href, pathname, search)) continue;
    const { path, params } = splitHref(item.href);
    const paramCount = Array.from(params.keys()).length;
    if (
      path.length > bestPathLen ||
      (path.length === bestPathLen && paramCount > bestParamCount)
    ) {
      bestKey = item.key;
      bestPathLen = path.length;
      bestParamCount = paramCount;
    }
  }
  return bestKey;
}

// ---------------------------------------------------------------------------
// Disabled-module guard helper
// ---------------------------------------------------------------------------

/**
 * Where a create/list route for a DISABLED module should send the user.
 * Prefers an enabled sibling with the same display name (PIFH's `deals` →
 * `members`), otherwise the module's own list page (which never renders a
 * create form). Returns `null` when the module is enabled — no redirect.
 */
export function disabledModuleRedirect(
  target: Pick<NavModule, 'key' | 'name_plural' | 'is_enabled'>,
  allModules: readonly NavModule[] = [],
): string | null {
  if (target.is_enabled !== false) return null;
  const sibling = navigableModules(allModules).find(
    (m) => m.key !== target.key && !!target.name_plural && m.name_plural === target.name_plural,
  );
  return moduleHref(sibling ? sibling.key : target.key);
}
