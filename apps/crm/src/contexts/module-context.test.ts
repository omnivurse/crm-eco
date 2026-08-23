/**
 * NV-2 / D10 — sticky top tab on client navigation.
 *
 * The sidebar must never swap under a link the user just clicked in it: every
 * cross-tab sidebar link (a link whose pathname resolves to ANOTHER tab) keeps
 * the current tab. Fresh loads / deep links still resolve from the URL.
 */
import { describe, expect, it, vi } from 'vitest';

// ModuleContext is a `use client` module importing next/navigation; the pure
// helpers under test never call the hooks.
vi.mock('next/navigation', () => ({
  usePathname: () => '/crm',
  useSearchParams: () => new URLSearchParams(''),
}));

import {
  CRM_NAV_ITEMS,
  TOP_MODULES,
  getNavItemsForModule,
  resolveStickyTopModule,
  resolveTopModuleFromPathname,
  type TopModule,
} from './ModuleContext';
import { buildFullCrmNav, type NavModule } from '@/lib/crm/nav-profile';

const ALL_TABS: TopModule[] = [...TOP_MODULES.map((m) => m.key), 'settings'];

function splitHref(href: string): { pathname: string; search: string } {
  const i = href.indexOf('?');
  return i === -1 ? { pathname: href, search: '' } : { pathname: href.slice(0, i), search: href.slice(i + 1) };
}

const PIFH_MODULES: NavModule[] = [
  { key: 'leads', name: 'Lead', name_plural: 'Leads', is_enabled: true, display_order: 1, field_count: 10 },
  { key: 'contacts', name: 'Contact', name_plural: 'Contacts', is_enabled: true, display_order: 2, field_count: 10 },
  { key: 'members', name: 'Member', name_plural: 'Members', is_enabled: true, display_order: 3, field_count: 10 },
  { key: 'accounts', name: 'Account', name_plural: 'Accounts', is_enabled: true, display_order: 4, field_count: 10 },
  { key: 'advisors', name: 'Advisor', name_plural: 'Advisors', is_enabled: true, display_order: 5, field_count: 10 },
];

/** Sidebar links (per tab) whose path resolves to a different tab. */
function crossTabLinks(): Array<{ tab: TopModule; key: string; href: string }> {
  const out: Array<{ tab: TopModule; key: string; href: string }> = [];
  for (const tab of ALL_TABS) {
    const items = tab === 'crm' ? buildFullCrmNav(CRM_NAV_ITEMS, PIFH_MODULES) : getNavItemsForModule(tab);
    for (const item of items) {
      if (item.separator || !item.href) continue;
      const { pathname } = splitHref(item.href);
      if (resolveTopModuleFromPathname(pathname) !== tab) out.push({ tab, key: item.key, href: item.href });
    }
  }
  return out;
}

describe('resolveStickyTopModule', () => {
  it('CRM → Inbox keeps the CRM tab (Inbox is a CRM sidebar link)', () => {
    expect(
      resolveStickyTopModule({ pathname: '/crm/inbox', search: '', previousPathname: '/crm', currentModule: 'crm' }),
    ).toBe('crm');
  });

  it('a fresh load / deep link resolves from the URL, whatever the current tab says', () => {
    expect(
      resolveStickyTopModule({ pathname: '/crm/inbox', search: '', previousPathname: null, currentModule: 'crm' }),
    ).toBe('communications');
    expect(
      resolveStickyTopModule({ pathname: '/crm/settings/fields', search: '', previousPathname: null, currentModule: 'revenue' }),
    ).toBe('settings');
    expect(
      resolveStickyTopModule({ pathname: '/crm', search: '', previousPathname: null, currentModule: 'analytics' }),
    ).toBe('crm');
  });

  it('a hop to a page the current tab does not list follows the URL', () => {
    expect(
      resolveStickyTopModule({ pathname: '/crm/products', search: '', previousPathname: '/crm/communications', currentModule: 'communications' }),
    ).toBe('revenue');
    // Record pages are CRM pages — no tab lists /crm/r/<id>.
    expect(
      resolveStickyTopModule({ pathname: '/crm/r/abc', search: '', previousPathname: '/crm/revenue', currentModule: 'revenue' }),
    ).toBe('crm');
  });

  it('query-qualified links stick only when the query matches (Comms › Call Logs)', () => {
    expect(
      resolveStickyTopModule({ pathname: '/crm/activities', search: 'type=call', previousPathname: '/crm/communications', currentModule: 'communications' }),
    ).toBe('communications');
    expect(
      resolveStickyTopModule({ pathname: '/crm/activities', search: '', previousPathname: '/crm/communications', currentModule: 'communications' }),
    ).toBe('crm');
  });

  it('every cross-tab sidebar link keeps its tab — the 17 links the plan enumerates', () => {
    const links = crossTabLinks();
    const byTab = new Map<string, string[]>();
    for (const l of links) byTab.set(l.tab, [...(byTab.get(l.tab) ?? []), l.key]);
    // NV-2 approach list: CRM→Inbox; Comms→Templates/Signatures/Email Domains/
    // Notifications/Call Logs; Revenue→Documents/Carriers/Premium Compare;
    // Ops→Import/Data Jobs; Analytics→Reports/Scorecards/Forecast;
    // Settings→Data Health/Recycle Bin/Developer Hub. (Data Health lives in the
    // CRM tab's Data Quality section beside Review Duplicates; Settings links
    // the same page for the admin who starts there, so it is cross-tab by
    // design — and, like the other two, must not swap the tab out mid-click.)
    expect(Object.fromEntries(byTab)).toEqual({
      crm: ['inbox'],
      communications: ['templates', 'signatures', 'domains', 'call-logs', 'notifications'],
      revenue: ['documents', 'carriers', 'premium-compare'],
      operations: ['import', 'data-jobs'],
      analytics: ['reports', 'scorecards', 'forecast-analytics'],
      settings: ['data-health', 'trash', 'developer'],
    });
    expect(links).toHaveLength(17);

    const swapped: string[] = [];
    for (const l of links) {
      const { pathname, search } = splitHref(l.href);
      const after = resolveStickyTopModule({
        pathname,
        search,
        previousPathname: `/crm/${l.tab === 'crm' ? '' : l.tab}`,
        currentModule: l.tab,
      });
      if (after !== l.tab) swapped.push(`${l.tab}›${l.key}→${after}`);
    }
    expect(swapped).toEqual([]);
  });

  it('a tab click then its own landing page keeps the clicked tab', () => {
    for (const tab of ALL_TABS) {
      const href = tab === 'settings' ? '/crm/settings' : TOP_MODULES.find((m) => m.key === tab)!.href;
      expect(
        resolveStickyTopModule({ pathname: href, search: '', previousPathname: '/crm/inbox', currentModule: tab }),
      ).toBe(tab);
    }
  });
});
