import { describe, expect, it } from 'vitest';
import { CREATE_RECORD_ROLES, canCreateRecords } from './can-create-records';

describe('canCreateRecords (DE-M1)', () => {
  it('allows admin, manager and agent', () => {
    for (const role of ['crm_admin', 'crm_manager', 'crm_agent']) {
      expect(canCreateRecords(role)).toBe(true);
    }
  });

  it('refuses crm_viewer, null, undefined and unknown roles (fail closed)', () => {
    expect(canCreateRecords('crm_viewer')).toBe(false);
    expect(canCreateRecords(null)).toBe(false);
    expect(canCreateRecords(undefined)).toBe(false);
    expect(canCreateRecords('')).toBe(false);
    expect(canCreateRecords('admin')).toBe(false);
    expect(canCreateRecords('CRM_ADMIN')).toBe(false);
  });

  it('mirrors the POST /api/crm/records role list exactly', () => {
    expect([...CREATE_RECORD_ROLES]).toEqual(['crm_admin', 'crm_manager', 'crm_agent']);
  });
});
