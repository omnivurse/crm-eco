import { describe, expect, it } from 'vitest';
import { resolveTopModuleFromPathname } from '../src/contexts/ModuleContext';
import { TOP_TAB_HREFS, topModuleForPath } from './nav-tabs';

const SAMPLE_PATHS = [
  '/crm',
  '/crm/modules/contacts',
  '/crm/modules/contacts?page=2',
  '/crm/workqueue',
  '/crm/pipeline',
  '/crm/call-logs',
  '/crm/communications',
  '/crm/campaigns',
  '/crm/sequences',
  '/crm/email/templates',
  '/crm/inbox',
  '/crm/revenue',
  '/crm/products',
  '/crm/quotes',
  '/crm/invoices',
  '/crm/forecasting',
  '/crm/commissions',
  '/crm/operations',
  '/crm/scheduling',
  '/crm/playbooks',
  '/crm/enrollment',
  '/crm/needs',
  '/crm/approvals',
  '/crm/vendors',
  '/crm/analytics',
  '/crm/executive',
  '/crm/integrations',
  '/crm/settings',
  '/crm/settings/fields',
  '/crm/r/abc',
];

describe('nav-tabs mirror of resolveTopModuleFromPathname', () => {
  it('agrees with the app for every sampled pathname', () => {
    for (const p of SAMPLE_PATHS) {
      expect(topModuleForPath(p), p).toBe(resolveTopModuleFromPathname(p));
    }
  });

  it('every tab href resolves to its own tab', () => {
    for (const { key, href } of TOP_TAB_HREFS) {
      expect(topModuleForPath(href)).toBe(key);
      expect(resolveTopModuleFromPathname(href)).toBe(key);
    }
  });
});
