/**
 * Mirror of `resolveTopModuleFromPathname` (apps/crm/src/contexts/ModuleContext.tsx)
 * for the nav walk: which top-level tab a sidebar href belongs to. Kept here
 * (not imported) because the e2e tsconfig has no JSX/`@/` resolution; the vitest
 * beside it (`nav-tabs.test.ts`) asserts this table against the real function
 * so the two cannot drift silently.
 */
export type TopModuleKey =
  | 'crm'
  | 'communications'
  | 'revenue'
  | 'operations'
  | 'analytics'
  | 'integrations'
  | 'settings';

const PREFIXES: Array<[TopModuleKey, string[]]> = [
  ['settings', ['/crm/settings']],
  ['integrations', ['/crm/integrations']],
  ['analytics', ['/crm/analytics', '/crm/executive']],
  [
    'operations',
    ['/crm/operations', '/crm/scheduling', '/crm/playbooks', '/crm/enrollment', '/crm/needs', '/crm/approvals', '/crm/vendors'],
  ],
  ['revenue', ['/crm/revenue', '/crm/products', '/crm/quotes', '/crm/invoices', '/crm/forecasting', '/crm/commissions']],
  ['communications', ['/crm/communications', '/crm/campaigns', '/crm/sequences', '/crm/email', '/crm/inbox']],
];

/** Top-level tab for a CRM pathname (query/hash stripped by the caller). */
export function topModuleForPath(pathname: string): TopModuleKey {
  for (const [key, prefixes] of PREFIXES) {
    if (prefixes.some((p) => pathname.startsWith(p))) return key;
  }
  return 'crm';
}

/** Module tab hrefs in the order the tab bar renders them (CRM first, Settings last). */
export const TOP_TAB_HREFS: Array<{ key: TopModuleKey; href: string }> = [
  { key: 'crm', href: '/crm' },
  { key: 'communications', href: '/crm/communications' },
  { key: 'revenue', href: '/crm/revenue' },
  { key: 'operations', href: '/crm/operations' },
  { key: 'analytics', href: '/crm/analytics' },
  { key: 'integrations', href: '/crm/integrations' },
  { key: 'settings', href: '/crm/settings' },
];
