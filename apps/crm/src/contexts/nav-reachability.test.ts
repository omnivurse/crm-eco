import { describe, it, expect, vi } from 'vitest';
import fg from 'fast-glob';
import path from 'node:path';
import {
  CRM_NAV_ITEMS,
  COMMUNICATIONS_NAV_ITEMS,
  REVENUE_NAV_ITEMS,
  OPERATIONS_NAV_ITEMS,
  ANALYTICS_NAV_ITEMS,
  INTEGRATIONS_NAV_ITEMS,
  SETTINGS_NAV_ITEMS,
  TOP_MODULES,
  type NavItem,
} from '@/contexts/ModuleContext';

// ModuleContext is a `use client` module that imports next/navigation at the top.
// We only consume its exported (plain-data) nav arrays here, so stub the hook.
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

/** Normalize an href to a comparable route path (drop query + trailing slash). */
function normalize(href: string): string {
  return href.split('?')[0].replace(/\/+$/, '') || '/';
}

/** Every destination declared in the module nav (the single source of truth). */
const navHrefs = new Set<string>();
for (const arr of [
  CRM_NAV_ITEMS,
  COMMUNICATIONS_NAV_ITEMS,
  REVENUE_NAV_ITEMS,
  OPERATIONS_NAV_ITEMS,
  ANALYTICS_NAV_ITEMS,
  INTEGRATIONS_NAV_ITEMS,
  SETTINGS_NAV_ITEMS,
]) {
  for (const item of arr as NavItem[]) {
    if ('href' in item && item.href) navHrefs.add(normalize(item.href));
  }
}
for (const m of TOP_MODULES) navHrefs.add(normalize(m.href));

/**
 * Routes intentionally reached outside the module rail (header, ⌘K palette,
 * their own index) — not orphans. Keep this list small and documented.
 */
const ALLOWLIST = new Set<string>([
  '/crm', // dashboard (also a TOP_MODULE)
  '/crm/learn', // help centre root — covers all /crm/learn/** via the ancestor rule
  // Object list routes that redirect to their canonical /crm/modules/<key> page:
  '/crm/contacts',
  '/crm/accounts',
  '/crm/deals',
  '/crm/leads',
  // Reached via the header, the ⌘K palette, or their own flow — not the module rail:
  '/crm/search',
  '/crm/profile',
  '/crm/features',
  '/crm/debug/offline',
  '/crm/imports',
  '/crm/imports/update',
]);

/** Convert a page.tsx path (relative to src/app) into its route. */
function routeFromFile(file: string): string {
  let r = '/' + file.replace(/\/page\.tsx$/, '');
  r = r.replace(/\/\([^)]+\)/g, ''); // strip route groups e.g. (auth)
  return r.replace(/\/+$/, '') || '/';
}

/**
 * A route is reachable if it (a) has a direct nav entry, (b) is a dynamic
 * detail route, (c) is a create/edit sub-route, (d) sits under a feature-root
 * that has a nav entry, or (e) is explicitly allow-listed.
 */
function isReachable(route: string): boolean {
  if (navHrefs.has(route) || ALLOWLIST.has(route)) return true;
  if (route.includes('[')) return true; // dynamic detail, reached from a list
  const last = route.split('/').pop() ?? '';
  if (last === 'new' || last === 'edit') return true; // create/edit from a list
  // sub-page whose feature-root ancestor (deeper than /crm) is a nav destination
  const parts = route.split('/'); // ['', 'crm', 'x', ...]
  for (let i = parts.length - 1; i > 2; i--) {
    const ancestor = parts.slice(0, i).join('/');
    if (navHrefs.has(ancestor) || ALLOWLIST.has(ancestor)) return true;
  }
  return false;
}

/** Does a concrete nav path match any route pattern (treating [x] as a single-segment wildcard)? */
function matchesRoute(navPath: string, routePatterns: string[]): boolean {
  const nav = navPath.split('/').filter(Boolean);
  return routePatterns.some((rp) => {
    const seg = rp.split('/').filter(Boolean);
    if (seg.length !== nav.length) return false;
    return seg.every((s, i) => s.startsWith('[') || s === nav[i]);
  });
}

describe('CRM navigation reachability', () => {
  it('every /crm page is reachable from the nav (no orphans)', async () => {
    const appDir = path.resolve(process.cwd(), 'src/app');
    const files = await fg('crm/**/page.tsx', { cwd: appDir });
    const routes = Array.from(new Set(files.map(routeFromFile)))
      .filter((r) => r.startsWith('/crm'))
      .sort();
    const orphans = routes.filter((r) => !isReachable(r));
    expect(
      orphans,
      `\n${orphans.length} unreachable /crm route(s) — add a nav entry in ModuleContext or an ALLOWLIST exception:\n  ${orphans.join('\n  ')}\n`,
    ).toEqual([]);
  });

  it('every nav href points to a real route (no dead links)', async () => {
    const appDir = path.resolve(process.cwd(), 'src/app');
    const files = await fg('crm/**/page.tsx', { cwd: appDir });
    const routePatterns = files.map(routeFromFile);
    const dead = Array.from(navHrefs)
      .filter((h) => !matchesRoute(h, routePatterns))
      .sort();
    expect(
      dead,
      `\n${dead.length} nav href(s) point to a non-existent route (fix the href in ModuleContext):\n  ${dead.join('\n  ')}\n`,
    ).toEqual([]);
  });
});
