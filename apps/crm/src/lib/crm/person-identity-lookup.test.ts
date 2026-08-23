import { describe, expect, it, vi } from 'vitest';
import {
  applyModuleIdFilter,
  coverageHasStarted,
  phoneLookupModuleKeys,
  planReactivate,
  resolveLookupModuleIds,
  resolvePeopleIdentityModuleIds,
  resolveReactivateStatus,
  shouldExpandPeopleLookup,
} from './person-identity-lookup';
import { isHistoricalStatus, isMembersSourceRow } from './person-module-keys';

function filterable() {
  return {
    eq: vi.fn(function eq(this: unknown) {
      return this;
    }),
    in: vi.fn(function inn(this: unknown) {
      return this;
    }),
  };
}

describe('PersonIdentityLookup', () => {
  it('expands Contacts and History, not Members or Leads', () => {
    expect(shouldExpandPeopleLookup('contacts')).toBe(true);
    expect(shouldExpandPeopleLookup('history')).toBe(true);
    expect(shouldExpandPeopleLookup('members')).toBe(false);
    expect(shouldExpandPeopleLookup('leads')).toBe(false);
  });

  it('treats Cancelled / Terminated / Deceased as historical', () => {
    expect(isHistoricalStatus('Cancelled')).toBe(true);
    expect(isHistoricalStatus('Terminated')).toBe(true);
    expect(isHistoricalStatus('Deceased')).toBe(true);
    expect(isHistoricalStatus('Lost')).toBe(false);
    expect(isHistoricalStatus('Inactive')).toBe(false);
  });

  it('applyModuleIdFilter uses eq for one id and in for many', () => {
    const one = filterable();
    applyModuleIdFilter(one, ['mod-contacts']);
    expect(one.eq).toHaveBeenCalledWith('module_id', 'mod-contacts');
    expect(one.in).not.toHaveBeenCalled();

    const many = filterable();
    applyModuleIdFilter(many, ['mod-contacts', 'mod-history']);
    expect(many.in).toHaveBeenCalledWith('module_id', ['mod-contacts', 'mod-history']);
    expect(many.eq).not.toHaveBeenCalled();
  });

  it('phone RPC walks contacts then history for people files', () => {
    expect(phoneLookupModuleKeys('contacts')).toEqual(['contacts', 'history']);
    expect(phoneLookupModuleKeys('history')).toEqual(['contacts', 'history']);
    expect(phoneLookupModuleKeys('leads')).toEqual(['leads']);
  });

  it('keeps the primary module id when History is not seeded yet', async () => {
    const from = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          in: () => Promise.resolve({ data: [{ id: 'mod-contacts', key: 'contacts' }], error: null }),
        }),
      }),
    }));
    const ids = await resolvePeopleIdentityModuleIds(
      { from } as never,
      'org-1',
      'mod-contacts',
    );
    expect(ids).toEqual(['mod-contacts']);
  });

  it('unions History onto a Contacts primary so a History email cannot insert', async () => {
    const from = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          in: () =>
            Promise.resolve({
              data: [
                { id: 'mod-contacts', key: 'contacts' },
                { id: 'mod-history', key: 'history' },
              ],
              error: null,
            }),
        }),
      }),
    }));
    const ids = await resolvePeopleIdentityModuleIds(
      { from } as never,
      'org-1',
      'mod-contacts',
    );
    expect(ids).toEqual(['mod-contacts', 'mod-history']);
  });

  it('does not expand leads imports even when History exists', async () => {
    const from = vi.fn();
    const ids = await resolveLookupModuleIds(
      { from } as never,
      'org-1',
      'mod-leads',
      'leads',
    );
    expect(ids).toEqual(['mod-leads']);
    expect(from).not.toHaveBeenCalled();
  });
});

describe('planReactivate', () => {
  it('fails closed when the status is not historical', () => {
    expect(
      planReactivate({ moduleKey: 'history', contactsModuleId: 'c', status: 'Active' }),
    ).toEqual({
      ok: false,
      status: 409,
      error: 'Only cancelled, terminated, or deceased people can be reactivated',
    });
  });

  it('fails closed when the row is a working Contact', () => {
    expect(
      planReactivate({ moduleKey: 'contacts', contactsModuleId: 'c', status: 'Cancelled' }),
    ).toEqual({
      ok: false,
      status: 409,
      error: 'Only History or cancelled Members records can be reactivated',
    });
  });

  it('moves History → Contacts and opens Active', () => {
    expect(
      planReactivate({ moduleKey: 'history', contactsModuleId: 'c', status: 'Cancelled' }),
    ).toEqual({
      ok: true,
      nextStatus: 'Active',
      nextModuleId: 'c',
    });
  });

  it('reactivates a Members-module row in place', () => {
    expect(
      planReactivate({ moduleKey: 'members', contactsModuleId: 'c', status: 'Terminated' }),
    ).toEqual({ ok: true, nextStatus: 'Active', nextModuleId: null });
  });

  it('does not hop a members-source twin', () => {
    expect(
      planReactivate({
        moduleKey: 'history',
        contactsModuleId: 'c',
        status: 'Cancelled',
        system: { source_table: 'members' },
      }),
    ).toEqual({ ok: true, nextStatus: 'Active', nextModuleId: null });
  });

  it('fails closed when Contacts is missing and the row would hop', () => {
    expect(
      planReactivate({ moduleKey: 'history', contactsModuleId: null, status: 'Cancelled' }),
    ).toEqual({
      ok: false,
      status: 409,
      error: 'Contacts module is not available for this organization',
    });
  });

  it('honors Pending when coverage has not started or the caller asks', () => {
    expect(
      planReactivate({
        moduleKey: 'history',
        contactsModuleId: 'c',
        status: 'Cancelled',
        coverageHasStarted: false,
      }),
    ).toEqual({ ok: true, nextStatus: 'Pending', nextModuleId: 'c' });
    expect(
      planReactivate({
        moduleKey: 'members',
        contactsModuleId: 'c',
        status: 'Cancelled',
        requestedStatus: 'Pending',
      }),
    ).toEqual({ ok: true, nextStatus: 'Pending', nextModuleId: null });
  });
});

describe('resolveReactivateStatus / coverageHasStarted', () => {
  it('defaults to Active and only accepts Active or Pending from the caller', () => {
    expect(resolveReactivateStatus({})).toBe('Active');
    expect(resolveReactivateStatus({ requestedStatus: 'Lost' })).toBe('Active');
    expect(resolveReactivateStatus({ requestedStatus: 'Pending' })).toBe('Pending');
    expect(resolveReactivateStatus({ coverageHasStarted: false })).toBe('Pending');
    expect(
      resolveReactivateStatus({ requestedStatus: 'Active', coverageHasStarted: false }),
    ).toBe('Active');
  });

  it('treats a missing start date as already started', () => {
    expect(coverageHasStarted({ data: {} }, '2026-08-23')).toBe(true);
    expect(
      coverageHasStarted({ data: { start_date: '2026-09-01' } }, '2026-08-23'),
    ).toBe(false);
    expect(
      coverageHasStarted({ current_year_start_date: '2026-01-01' }, '2026-08-23'),
    ).toBe(true);
  });
});

describe('isMembersSourceRow', () => {
  it('only matches system.source_table = members', () => {
    expect(isMembersSourceRow({ source_table: 'members' })).toBe(true);
    expect(isMembersSourceRow({ source_table: 'contacts' })).toBe(false);
    expect(isMembersSourceRow(null)).toBe(false);
  });
});
