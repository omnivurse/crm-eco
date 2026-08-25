import { describe, expect, it } from 'vitest';
import { crmRoleForCatalogKey } from './catalog-role-map';

describe('catalog-role-map', () => {
  it('maps system catalog keys to CRM roles', () => {
    expect(crmRoleForCatalogKey('admin')).toBe('crm_admin');
    expect(crmRoleForCatalogKey('manager')).toBe('crm_manager');
    expect(crmRoleForCatalogKey('advisor')).toBe('crm_agent');
    expect(crmRoleForCatalogKey('support')).toBe('crm_viewer');
    expect(crmRoleForCatalogKey('ceo')).toBe('crm_admin');
  });

  it('returns null for custom / unknown keys', () => {
    expect(crmRoleForCatalogKey('custom_ops')).toBeNull();
  });
});
