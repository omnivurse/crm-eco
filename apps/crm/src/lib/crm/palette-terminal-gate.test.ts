import { describe, expect, it } from 'vitest';
import { canCreateRecords } from './can-create-records';
import { terminalCommandAllowed } from './palette-terminal-gate';

describe('terminalCommandAllowed (DE-M1)', () => {
  const newCmd = { requiresCreate: true };
  const dealsCmd = { requiresDeals: true };
  const plain = {};

  it('hides create commands from crm_viewer / unknown roles and keeps them for creators', () => {
    for (const role of ['crm_viewer', null, undefined, '']) {
      expect(terminalCommandAllowed(newCmd, { dealsEnabled: true, canCreate: canCreateRecords(role) })).toBe(false);
    }
    for (const role of ['crm_admin', 'crm_manager', 'crm_agent']) {
      expect(terminalCommandAllowed(newCmd, { dealsEnabled: false, canCreate: canCreateRecords(role) })).toBe(true);
    }
  });

  it('keeps the deals gate and never blocks plain commands', () => {
    expect(terminalCommandAllowed(dealsCmd, { dealsEnabled: false, canCreate: true })).toBe(false);
    expect(terminalCommandAllowed(dealsCmd, { dealsEnabled: true, canCreate: false })).toBe(true);
    expect(terminalCommandAllowed(plain, { dealsEnabled: false, canCreate: false })).toBe(true);
  });
});
