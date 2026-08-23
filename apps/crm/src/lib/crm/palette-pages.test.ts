import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/crm',
  useSearchParams: () => new URLSearchParams(''),
}));

import {
  CRM_NAV_ITEMS,
  TOP_MODULES,
  getNavItemsForModule,
  type TopModule,
} from '@/contexts/ModuleContext';
import { buildFullCrmNav, type NavModule } from '@/lib/crm/nav-profile';
import {
  PERSONA_IDLE_PAGE_HREFS,
  buildPalettePages,
  palettePageMatches,
  personaIdlePages,
} from './palette-pages';

const mod = (key: string, over: Partial<NavModule> = {}): NavModule => ({
  key,
  name: key.slice(0, -1),
  name_plural: key[0].toUpperCase() + key.slice(1),
  is_enabled: true,
  display_order: 1,
  field_count: 5,
  ...over,
});

const PIFH = [
  mod('leads', { display_order: 1 }),
  mod('contacts', { display_order: 2 }),
  mod('members', { display_order: 3 }),
  mod('accounts', { display_order: 4 }),
  mod('advisors', { display_order: 5 }),
];
const WITH_DEALS = [...PIFH, mod('deals', { display_order: 6 })];

const ALL_TABS: TopModule[] = [...TOP_MODULES.map((m) => m.key), 'settings'];

describe('buildPalettePages', () => {
  it('lists every non-separator sidebar href exactly once (admin, deals + advisors on)', () => {
    const pages = buildPalettePages({ modules: WITH_DEALS, crmRole: 'crm_admin' });
    const hrefs = pages.map((p) => p.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);

    const expected = new Set<string>();
    for (const tab of ALL_TABS) {
      const items = tab === 'crm' ? buildFullCrmNav(CRM_NAV_ITEMS, WITH_DEALS) : getNavItemsForModule(tab);
      for (const item of items) if (!item.separator && item.href) expected.add(item.href);
    }
    expect(new Set(hrefs)).toEqual(expected);
    // Inbox / Reports / Import / Documents are reachable from several tabs —
    // one row each, attributed to the first (CRM) tab.
    expect(pages.find((p) => p.href === '/crm/inbox')?.tab).toBe('crm');
    expect(pages.find((p) => p.href === '/crm/reports')?.tab).toBe('crm');
    expect(pages.filter((p) => p.href === '/crm/import')).toHaveLength(1);
    expect(pages.some((p) => p.href === '/crm/pipeline')).toBe(true);
    expect(pages.some((p) => p.href === '/crm/modules/advisors')).toBe(true);
  });

  it('is module-gated like the sidebar: no Pipeline without deals, no Advisors without advisors', () => {
    const noDeals = buildPalettePages({ modules: PIFH, crmRole: 'crm_admin' });
    expect(noDeals.some((p) => p.href === '/crm/pipeline')).toBe(false);
    expect(noDeals.some((p) => p.href === '/crm/modules/advisors')).toBe(true);

    const noAdvisors = buildPalettePages({
      modules: PIFH.map((m) => (m.key === 'advisors' ? { ...m, is_enabled: false } : m)),
      crmRole: 'crm_admin',
    });
    expect(noAdvisors.some((p) => p.href === '/crm/modules/advisors')).toBe(false);
    // Module list links come from crm_modules, not the static baseline.
    expect(noAdvisors.some((p) => p.href === '/crm/modules/members')).toBe(true);
  });

  it('is role-gated like the sidebar: agents do not see admin-only Settings pages (unknown role = agent)', () => {
    const agent = buildPalettePages({ modules: PIFH, crmRole: 'crm_agent' });
    expect(agent.some((p) => p.href === '/crm/trash')).toBe(false);
    expect(agent.some((p) => p.href === '/crm/settings/users')).toBe(false);
    expect(agent.some((p) => p.href === '/crm/settings/templates')).toBe(true);
    const unknown = buildPalettePages({ modules: PIFH });
    expect(unknown.some((p) => p.href === '/crm/trash')).toBe(false);
    const admin = buildPalettePages({ modules: PIFH, crmRole: 'crm_admin' });
    expect(admin.some((p) => p.href === '/crm/trash')).toBe(true);
  });

  it('carries tab + section + keywords so "task" finds Tasks', () => {
    const pages = buildPalettePages({ modules: PIFH, crmRole: 'crm_agent' });
    const tasks = pages.find((p) => p.href === '/crm/tasks');
    expect(tasks).toMatchObject({ label: 'Tasks', tab: 'crm', tabLabel: 'CRM', section: 'Engagement' });
    expect(pages.filter((p) => palettePageMatches(p, 'task')).map((p) => p.label)).toEqual(['Tasks']);
    expect(palettePageMatches(tasks!, '')).toBe(false);
    // keyword on the nav key too ("module-members" → "members")
    const members = pages.find((p) => p.href === '/crm/modules/members');
    expect(members?.keywords).toContain('members');
  });

  it('simple profile: flat menu + role-gated settings only', () => {
    const pages = buildPalettePages({ modules: PIFH, crmRole: 'crm_agent', navProfile: 'simple' });
    expect(pages.map((p) => p.href)).toEqual([
      '/crm',
      '/crm/workqueue',
      '/crm/modules/leads',
      '/crm/modules/contacts',
      '/crm/modules/members',
      '/crm/modules/accounts',
      '/crm/modules/advisors',
      '/crm/tasks',
      '/crm/calendar',
      '/crm/reports',
      '/crm/inbox',
      '/crm/settings',
      '/crm/settings/templates',
      '/crm/settings/signatures',
      '/crm/settings/comms',
      '/crm/settings/mappings',
      '/crm/settings/landing-pages',
    ]);
  });
});

describe('personaIdlePages', () => {
  it('returns the D10 persona set in order, only the pages that exist', () => {
    // A manager sees the full set; "Import Data" is manager/admin-only (NV-2:
    // /crm/import bounces agents), so the agent set is the same minus Import.
    const pages = buildPalettePages({ modules: PIFH, crmRole: 'crm_manager' });
    expect(personaIdlePages(pages).map((p) => p.href)).toEqual([...PERSONA_IDLE_PAGE_HREFS]);
    expect(personaIdlePages(pages).map((p) => p.label)).toEqual([
      'Members', 'Member Roster', 'Tasks', 'Calendar', 'Inbox', 'Reports', 'Workqueue', 'Import Data',
    ]);
    const agentPages = buildPalettePages({ modules: PIFH, crmRole: 'crm_agent' });
    expect(personaIdlePages(agentPages).map((p) => p.href)).toEqual(
      PERSONA_IDLE_PAGE_HREFS.filter((h) => h !== '/crm/import'),
    );
    expect(agentPages.some((p) => p.href.startsWith('/crm/import'))).toBe(false);
    const noMembers = buildPalettePages({ modules: PIFH.filter((m) => m.key !== 'members'), crmRole: 'crm_manager' });
    expect(personaIdlePages(noMembers).map((p) => p.href)).not.toContain('/crm/modules/members');
    expect(personaIdlePages(noMembers)).toHaveLength(PERSONA_IDLE_PAGE_HREFS.length - 1);
  });
});
