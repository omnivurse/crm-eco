import { describe, it, expect } from 'vitest';
import {
  buildSimpleNav,
  buildFullCrmNav,
  isNavHrefActive,
  resolveActiveNavKey,
  disabledModuleRedirect,
  visibleNavItemsForRole,
  isCrmAdminRole,
  isCrmManagerOrAdminRole,
  recordPageActiveNavKey,
  type NavModule,
} from './nav-profile';
import { CRM_NAV_ITEMS, getNavItemsForModule, type NavItem } from '@/contexts/ModuleContext';

// Mirrors PIFH's live crm_modules rows (2026-08-17).
const PIFH_MODULES: NavModule[] = [
  { key: 'enrollment_approval_test', name: 'Test', name_plural: null, icon: 'file', is_enabled: false, display_order: 0, field_count: 0 },
  { key: 'contacts', name: 'Contact', name_plural: 'Contacts', icon: 'user', is_enabled: true, display_order: 1, field_count: 258 },
  { key: 'members', name: 'Member', name_plural: 'Members', icon: 'heart', is_enabled: true, display_order: 2, field_count: 91 },
  { key: 'leads', name: 'Lead', name_plural: 'Leads', icon: 'user-plus', is_enabled: true, display_order: 2, field_count: 148 },
  { key: 'advisors', name: 'Advisor', name_plural: 'Advisors', icon: 'briefcase', is_enabled: true, display_order: 3, field_count: 9 },
  { key: 'deals', name: 'Deal', name_plural: 'Members', icon: 'users', is_enabled: false, display_order: 3, field_count: 7 },
  { key: 'accounts', name: 'Account', name_plural: 'Accounts', icon: 'building', is_enabled: true, display_order: 4, field_count: 7 },
  { key: 'prospects', name: 'Prospect', name_plural: 'Prospects', icon: 'target', is_enabled: false, display_order: 5, field_count: 106 },
];

const labels = (items: NavItem[]) => items.filter((i) => !i.separator).map((i) => i.label);
const hrefs = (items: NavItem[]) => items.filter((i) => !i.separator).map((i) => i.href);

describe('buildSimpleNav', () => {
  it('yields Dashboard, Workqueue, enabled modules in display_order, then Tasks/Calendar/Reports/Inbox', () => {
    const nav = buildSimpleNav(PIFH_MODULES);
    expect(nav.some((i) => i.separator)).toBe(false);
    expect(labels(nav)).toEqual([
      'Dashboard', 'Workqueue',
      'Contacts', 'Leads', 'Members', 'Advisors', 'Accounts',
      'Tasks', 'Calendar', 'Reports', 'Inbox',
    ]);
    expect(hrefs(nav)).toContain('/crm/modules/advisors');
    expect(hrefs(nav)).not.toContain('/crm/members');
  });

  it('never lists disabled or 0-field modules', () => {
    const nav = buildSimpleNav(PIFH_MODULES);
    for (const bad of ['deals', 'prospects', 'enrollment_approval_test']) {
      expect(hrefs(nav)).not.toContain(`/crm/modules/${bad}`);
    }
    const zeroField = buildSimpleNav([
      { key: 'ghost', name: 'Ghost', name_plural: 'Ghosts', is_enabled: true, display_order: 1, field_count: 0 },
    ]);
    expect(labels(zeroField)).not.toContain('Ghosts');
  });

  it('keeps a module whose field count is unknown, and uses name_plural / name fallback', () => {
    const nav = buildSimpleNav([
      { key: 'x', name: 'Thing', name_plural: null, is_enabled: true, display_order: 1 },
    ]);
    expect(labels(nav)).toContain('Thing');
  });

  it('degrades to the fixed links when the org has no modules', () => {
    expect(labels(buildSimpleNav([]))).toEqual([
      'Dashboard', 'Workqueue', 'Tasks', 'Calendar', 'Reports', 'Inbox',
    ]);
  });
});

// Static CRM baseline (mirrors CRM_NAV_ITEMS' shape) shared by the full-nav suites.
const BASE: NavItem[] = [
    { key: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', href: '/crm' },
    { key: 'sec-pipeline', separator: true, sectionTitle: 'People' },
    { key: 'leads', label: 'Leads', icon: 'user-plus', href: '/crm/modules/leads' },
    { key: 'contacts', label: 'Contacts', icon: 'users', href: '/crm/modules/contacts' },
    { key: 'accounts', label: 'Accounts', icon: 'building', href: '/crm/modules/accounts' },
    { key: 'members', label: 'Members', icon: 'shield-check', href: '/crm/modules/members' },
    { key: 'pipeline', label: 'Pipeline', icon: 'kanban', href: '/crm/pipeline' },
    { key: 'sec-people', separator: true, sectionTitle: 'People Management' },
    { key: 'advisors', label: 'Advisors', icon: 'user-cog', href: '/crm/modules/advisors' },
    { key: 'member-roster', label: 'Member Roster', icon: 'heart-pulse', href: '/crm/members' },
];

describe('buildFullCrmNav', () => {
  it('drives the People section from crm_modules and keeps Advisors when enabled', () => {
    const nav = buildFullCrmNav(BASE, PIFH_MODULES);
    // PIFH has deals disabled → no Pipeline link (NV-5 / D10).
    expect(labels(nav)).toEqual([
      'Dashboard',
      'Contacts', 'Leads', 'Members', 'Accounts',
      'Advisors', 'Member Roster',
    ]);
    expect(hrefs(nav)).not.toContain('/crm/modules/deals');
    expect(hrefs(nav)).not.toContain('/crm/modules/prospects');
    expect(nav.find((i) => i.key === 'sec-pipeline')?.sectionTitle).toBe('People');
  });

  it('hides Pipeline when deals is disabled and shows it when deals is enabled', () => {
    expect(labels(buildFullCrmNav(BASE, PIFH_MODULES))).not.toContain('Pipeline');
    expect(hrefs(buildFullCrmNav(BASE, PIFH_MODULES))).not.toContain('/crm/pipeline');
    const withDeals = PIFH_MODULES.map((m) => (m.key === 'deals' ? { ...m, is_enabled: true } : m));
    const nav = buildFullCrmNav(BASE, withDeals);
    expect(hrefs(nav)).toContain('/crm/pipeline');
    expect(hrefs(nav)).toContain('/crm/modules/deals');
    // Pipeline follows the injected module links, before People Management.
    expect(labels(nav).indexOf('Pipeline')).toBeGreaterThan(labels(nav).indexOf('Members'));
    expect(labels(nav).indexOf('Pipeline')).toBeLessThan(labels(nav).indexOf('Advisors'));
  });

  it('hides Advisors when the advisors module is disabled', () => {
    const mods = PIFH_MODULES.map((m) => (m.key === 'advisors' ? { ...m, is_enabled: false } : m));
    const nav = buildFullCrmNav(BASE, mods);
    expect(labels(nav)).not.toContain('Advisors');
    expect(labels(nav)).toContain('Member Roster');
  });

  it('keeps the static links when the org has no modules', () => {
    const nav = buildFullCrmNav(BASE, []);
    // no module links, no advisors, no deals → no Pipeline; roster remains
    expect(labels(nav)).toEqual(['Dashboard', 'Member Roster']);
  });
});

describe('visibleNavItemsForRole (NV-M1)', () => {
  const SETTINGS: NavItem[] = [
    { key: 'general', label: 'General', icon: 'settings', href: '/crm/settings' },
    { key: 'sec-org', separator: true, sectionTitle: 'Organization' },
    { key: 'users', label: 'Users & Teams', icon: 'users', href: '/crm/settings/users', adminOnly: true },
    { key: 'roles', label: 'Roles', icon: 'shield', href: '/crm/settings/users?tab=roles', adminOnly: true },
    { key: 'sec-comm', separator: true, sectionTitle: 'Communication' },
    { key: 'templates', label: 'Templates', icon: 'file-text', href: '/crm/settings/templates' },
    { key: 'email-domains', label: 'Email Domains', icon: 'globe', href: '/crm/settings/email-domains', adminOnly: true },
    { key: 'sec-advanced', separator: true, sectionTitle: 'Advanced' },
    { key: 'configuration', label: 'Configuration', icon: 'sliders', href: '/crm/settings/configuration', adminOnly: true },
  ];

  it('uses the settings-cards predicate: only crm_admin is admin', () => {
    expect(isCrmAdminRole('crm_admin')).toBe(true);
    for (const r of ['crm_manager', 'crm_agent', 'crm_viewer', null, undefined, '']) {
      expect(isCrmAdminRole(r)).toBe(false);
    }
  });

  it('returns the list untouched for admins', () => {
    expect(visibleNavItemsForRole(SETTINGS, 'crm_admin')).toBe(SETTINGS);
  });

  it('hides admin-only links AND emptied section headers for agents (fail closed on unknown role)', () => {
    for (const role of ['crm_agent', 'crm_viewer', null, undefined]) {
      const items = visibleNavItemsForRole(SETTINGS, role);
      expect(items.map((i) => i.key)).toEqual(['general', 'sec-comm', 'templates']);
    }
  });

  it('keeps every non-admin link and never invents one', () => {
    const agent = visibleNavItemsForRole(SETTINGS, 'crm_agent');
    const kept = SETTINGS.filter((i) => !i.separator && !i.adminOnly).map((i) => i.key);
    expect(agent.filter((i) => !i.separator).map((i) => i.key)).toEqual(kept);
    expect(agent.every((i) => i.separator || !i.adminOnly)).toBe(true);
  });

  // NV-2: /crm/import bounces anyone but crm_admin | crm_manager, so its nav
  // links carry `managerOrAdmin` and follow the page's predicate exactly.
  const OPS: NavItem[] = [
    { key: 'overview', label: 'Overview', icon: 'home', href: '/crm/operations' },
    { key: 'sec-data', separator: true, sectionTitle: 'Data Management' },
    { key: 'import', label: 'Import / Export', icon: 'upload', href: '/crm/import', managerOrAdmin: true },
  ];

  it('isCrmManagerOrAdminRole mirrors app/crm/import/page.tsx', () => {
    expect(isCrmManagerOrAdminRole('crm_admin')).toBe(true);
    expect(isCrmManagerOrAdminRole('crm_manager')).toBe(true);
    for (const r of ['crm_agent', 'crm_viewer', null, undefined, '']) {
      expect(isCrmManagerOrAdminRole(r)).toBe(false);
    }
  });

  it('shows managerOrAdmin links to managers and admins, hides them (and the emptied section) from agents/viewers/unknown', () => {
    expect(visibleNavItemsForRole(OPS, 'crm_admin').map((i) => i.key)).toEqual(['overview', 'sec-data', 'import']);
    expect(visibleNavItemsForRole(OPS, 'crm_manager').map((i) => i.key)).toEqual(['overview', 'sec-data', 'import']);
    for (const role of ['crm_agent', 'crm_viewer', null, undefined]) {
      expect(visibleNavItemsForRole(OPS, role).map((i) => i.key)).toEqual(['overview']);
    }
  });

  it('the real nav data gates every /crm/import link (CRM + Operations) for agents', () => {
    const agentHrefs = [
      ...visibleNavItemsForRole(buildFullCrmNav(CRM_NAV_ITEMS, PIFH_MODULES), 'crm_agent'),
      ...visibleNavItemsForRole(getNavItemsForModule('operations'), 'crm_agent'),
    ]
      .filter((i) => !i.separator)
      .map((i) => i.href);
    expect(agentHrefs.some((h) => h.startsWith('/crm/import'))).toBe(false);
    const managerHrefs = [
      ...visibleNavItemsForRole(buildFullCrmNav(CRM_NAV_ITEMS, PIFH_MODULES), 'crm_manager'),
      ...visibleNavItemsForRole(getNavItemsForModule('operations'), 'crm_manager'),
    ]
      .filter((i) => !i.separator)
      .map((i) => i.href);
    expect(managerHrefs.filter((h) => h.startsWith('/crm/import')).length).toBeGreaterThanOrEqual(2);
  });
});

describe('recordPageActiveNavKey (NV-7)', () => {
  const ITEMS = buildFullCrmNav(BASE, PIFH_MODULES);
  it('highlights the module list link on /crm/r/<id> when the record module is known', () => {
    expect(recordPageActiveNavKey(ITEMS, '/crm/r/abc', 'members')).toBe('module-members');
    expect(recordPageActiveNavKey(ITEMS, '/crm/r/abc', 'contacts')).toBe('module-contacts');
  });
  it('falls back to no highlight off record pages, for unknown modules, or modules without a link', () => {
    expect(recordPageActiveNavKey(ITEMS, '/crm/modules/members', 'members')).toBeNull();
    expect(recordPageActiveNavKey(ITEMS, '/crm/r/abc', null)).toBeNull();
    expect(recordPageActiveNavKey(ITEMS, '/crm/r/abc', undefined)).toBeNull();
    expect(recordPageActiveNavKey(ITEMS, '/crm/r/abc', 'deals')).toBeNull();
  });
});

describe('isNavHrefActive', () => {
  it('dashboard is exact-only', () => {
    expect(isNavHrefActive('/crm', '/crm')).toBe(true);
    expect(isNavHrefActive('/crm', '/crm/tasks')).toBe(false);
  });

  it('matches path descendants but not sibling prefixes', () => {
    expect(isNavHrefActive('/crm/vendors', '/crm/vendors/upload')).toBe(true);
    expect(isNavHrefActive('/crm/vendors', '/crm/vendorsx')).toBe(false);
  });

  it('requires every href query param to be present in the current search', () => {
    expect(isNavHrefActive('/crm/modules/contacts?tab=groups', '/crm/modules/contacts', '?tab=groups')).toBe(true);
    expect(isNavHrefActive('/crm/modules/contacts?tab=groups', '/crm/modules/contacts', new URLSearchParams('tab=groups&page=2'))).toBe(true);
    expect(isNavHrefActive('/crm/modules/contacts?tab=groups', '/crm/modules/contacts', '')).toBe(false);
    expect(isNavHrefActive('/crm/modules/contacts?tab=groups', '/crm/modules/contacts', '?tab=segments')).toBe(false);
  });
});

describe('resolveActiveNavKey', () => {
  const ITEMS: NavItem[] = [
    { key: 'dashboard', label: 'Dashboard', icon: 'x', href: '/crm' },
    { key: 'contacts', label: 'Contacts', icon: 'x', href: '/crm/modules/contacts' },
    { key: 'contact-groups', label: 'Contact Groups', icon: 'x', href: '/crm/modules/contacts?tab=groups' },
    { key: 'sec', separator: true },
    { key: 'vendors', label: 'Vendor Hub', icon: 'x', href: '/crm/vendors' },
    { key: 'vendor-upload', label: 'Upload Files', icon: 'x', href: '/crm/vendors/upload' },
  ];

  it('highlights the ?tab item and not its parent', () => {
    expect(resolveActiveNavKey(ITEMS, '/crm/modules/contacts', '?tab=groups')).toBe('contact-groups');
  });

  it('falls back to the parent when no tab item matches', () => {
    expect(resolveActiveNavKey(ITEMS, '/crm/modules/contacts', '')).toBe('contacts');
    expect(resolveActiveNavKey(ITEMS, '/crm/modules/contacts', '?tab=unknown')).toBe('contacts');
  });

  it('prefers the deepest matching path', () => {
    expect(resolveActiveNavKey(ITEMS, '/crm/vendors/upload')).toBe('vendor-upload');
    expect(resolveActiveNavKey(ITEMS, '/crm/vendors')).toBe('vendors');
  });

  it('returns null when nothing matches', () => {
    expect(resolveActiveNavKey(ITEMS, '/crm/settings')).toBeNull();
  });
});

describe('disabledModuleRedirect', () => {
  it('returns null for enabled modules', () => {
    expect(disabledModuleRedirect(PIFH_MODULES[1], PIFH_MODULES)).toBeNull();
  });
  it('sends a disabled module to its enabled same-name sibling', () => {
    const deals = PIFH_MODULES.find((m) => m.key === 'deals')!;
    expect(disabledModuleRedirect(deals, PIFH_MODULES)).toBe('/crm/modules/members');
  });
  it('sends a disabled module with no sibling to its own list page (never the create form)', () => {
    const prospects = PIFH_MODULES.find((m) => m.key === 'prospects')!;
    expect(disabledModuleRedirect(prospects, PIFH_MODULES)).toBe('/crm/modules/prospects');
    expect(disabledModuleRedirect(prospects)).toBe('/crm/modules/prospects');
  });
});
