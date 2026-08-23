/**
 * NV-3 / D10 — every page the sidebar can reach, flattened for the ⌘K palette.
 *
 * Pure: the same nav builders the sidebar uses (`buildFullCrmNav` for the CRM
 * tab — module-driven People links, Pipeline only with `deals`, Advisors only
 * with `advisors`; `visibleNavItemsForRole` for admin-only Settings links), so
 * the palette never offers a page the sidebar hides. De-duplicated by href:
 * Inbox / Reports / Documents / Import appear under several tabs but are one
 * page each — the first tab (CRM-first) wins.
 *
 * Palette contract (D10): page rows are TYPED-ONLY (≥ 1 character); idle shows
 * recents + the persona set below.
 */

import {
  CRM_NAV_ITEMS,
  TOP_MODULES,
  TOP_MODULE_TITLES,
  getNavItemsForModule,
  type NavItem,
  type TopModule,
} from '@/contexts/ModuleContext';
import {
  buildFullCrmNav,
  buildSimpleNav,
  visibleNavItemsForRole,
  type NavModule,
  type NavProfile,
} from '@/lib/crm/nav-profile';

export interface PalettePage {
  /** `<tab>:<nav key>` — unique even when two tabs share a nav key. */
  key: string;
  label: string;
  href: string;
  tab: TopModule;
  tabLabel: string;
  /** Sidebar section heading the link sits under (if any). */
  section: string | null;
  icon: string;
  /** Lower-cased match terms: label, nav key, tab, section. */
  keywords: string[];
}

export interface BuildPalettePagesOptions {
  /** The org's enabled crm_modules (+ field counts) — same input as the sidebar. */
  modules: readonly NavModule[];
  /** `profiles.crm_role`; unknown = not admin (fail closed, like the sidebar). */
  crmRole?: string | null;
  navProfile?: NavProfile;
}

/** Tabs in the order the tab strip renders them (CRM first, Settings last). */
export const PALETTE_TABS: TopModule[] = [...TOP_MODULES.map((m) => m.key), 'settings'];

function navItemsForTab(tab: TopModule, opts: BuildPalettePagesOptions): NavItem[] {
  const role = opts.crmRole ?? null;
  if (opts.navProfile === 'simple') {
    // One flat menu (+ Settings, role-gated) — mirrors ZohoContextualSidebar.
    if (tab === 'crm') return buildSimpleNav(opts.modules);
    if (tab === 'settings') return visibleNavItemsForRole(getNavItemsForModule('settings'), role);
    return [];
  }
  if (tab === 'crm') return visibleNavItemsForRole(buildFullCrmNav(CRM_NAV_ITEMS, opts.modules), role);
  return visibleNavItemsForRole(getNavItemsForModule(tab), role);
}

function normalizeHref(href: string): string {
  const [path, query = ''] = href.split('?');
  const p = path.replace(/\/+$/, '') || '/';
  return query ? `${p}?${query}` : p;
}

/** Flatten the sidebar (all tabs) into palette pages, de-duplicated by href. */
export function buildPalettePages(opts: BuildPalettePagesOptions): PalettePage[] {
  const seen = new Set<string>();
  const out: PalettePage[] = [];
  for (const tab of PALETTE_TABS) {
    const tabLabel = TOP_MODULE_TITLES[tab];
    let section: string | null = null;
    for (const item of navItemsForTab(tab, opts)) {
      if (item.separator) {
        section = item.sectionTitle ?? null;
        continue;
      }
      if (!item.href) continue;
      const href = normalizeHref(item.href);
      if (seen.has(href)) continue;
      seen.add(href);
      const keywords = new Set<string>([
        item.label.toLowerCase(),
        item.key.toLowerCase().replace(/^module-/, ''),
        tabLabel.toLowerCase(),
      ]);
      if (section) keywords.add(section.toLowerCase());
      out.push({
        key: `${tab}:${item.key}`,
        label: item.label,
        href,
        tab,
        tabLabel,
        section,
        icon: item.icon,
        keywords: Array.from(keywords),
      });
    }
  }
  return out;
}

/**
 * Idle persona set (D10): what an agent opens all day — shown before typing,
 * in this order, only when the page exists for this org/role.
 */
export const PERSONA_IDLE_PAGE_HREFS: readonly string[] = [
  '/crm/modules/members',
  '/crm/members',
  '/crm/tasks',
  '/crm/calendar',
  '/crm/inbox',
  '/crm/reports',
  '/crm/workqueue',
  '/crm/import',
];

export function personaIdlePages(pages: readonly PalettePage[]): PalettePage[] {
  const byHref = new Map(pages.map((p) => [p.href, p]));
  const out: PalettePage[] = [];
  for (const href of PERSONA_IDLE_PAGE_HREFS) {
    const page = byHref.get(href);
    if (page) out.push(page);
  }
  return out;
}

/**
 * Typed match — the same contract the palette applies to every base command
 * (label / keywords substring), kept here so it is unit-testable.
 */
export function palettePageMatches(page: PalettePage, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  return page.label.toLowerCase().includes(q) || page.keywords.some((k) => k.includes(q));
}
