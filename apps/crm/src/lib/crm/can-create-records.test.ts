import { describe, expect, it } from 'vitest';
import { CREATE_RECORD_ROLES, canCreateRecords, canManageRecords } from './can-create-records';
import { isCrmManagerOrAdminRole } from './nav-profile';

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

describe('canManageRecords (PERM-1)', () => {
  it('allows admin and manager only', () => {
    expect(canManageRecords('crm_admin')).toBe(true);
    expect(canManageRecords('crm_manager')).toBe(true);
  });

  it('refuses crm_agent — the manager-only routes 403 them (the dead end PERM-1 removes)', () => {
    expect(canManageRecords('crm_agent')).toBe(false);
  });

  it('refuses crm_viewer, null, undefined and unknown roles (fail closed)', () => {
    expect(canManageRecords('crm_viewer')).toBe(false);
    expect(canManageRecords(null)).toBe(false);
    expect(canManageRecords(undefined)).toBe(false);
    expect(canManageRecords('')).toBe(false);
    expect(canManageRecords('manager')).toBe(false);
    expect(canManageRecords('CRM_MANAGER')).toBe(false);
  });

  it('mirrors the DELETE /api/crm/records/[id] + PATCH|DELETE /bulk role list exactly', () => {
    const serverAllows = ['crm_admin', 'crm_manager'];
    for (const role of ['crm_admin', 'crm_manager', 'crm_agent', 'crm_viewer', 'nonsense']) {
      expect(canManageRecords(role)).toBe(serverAllows.includes(role));
    }
  });

  it('stays the same predicate as isCrmManagerOrAdminRole (one source of truth)', () => {
    for (const role of ['crm_admin', 'crm_manager', 'crm_agent', 'crm_viewer', '', 'x', null, undefined]) {
      expect(canManageRecords(role)).toBe(isCrmManagerOrAdminRole(role));
    }
  });

  it('is strictly narrower than canCreateRecords — an agent may create but not delete', () => {
    expect(canCreateRecords('crm_agent')).toBe(true);
    expect(canManageRecords('crm_agent')).toBe(false);
    for (const role of ['crm_admin', 'crm_manager', 'crm_agent', 'crm_viewer']) {
      if (canManageRecords(role)) expect(canCreateRecords(role)).toBe(true);
    }
  });
});
