import { describe, expect, it } from 'vitest';
import {
  captureCreateOrigin,
  createOriginModuleKey,
  resolveCreateIntent,
  resolveCreateReturnList,
} from './create-intent';

describe('resolveCreateIntent', () => {
  it('opens the contact drawer for contacts and members', () => {
    expect(resolveCreateIntent({ moduleKey: 'contacts' })).toEqual({
      kind: 'quick',
      moduleKey: 'contacts',
    });
    expect(resolveCreateIntent({ moduleKey: 'members' })).toEqual({
      kind: 'quick',
      moduleKey: 'contacts',
    });
  });

  it('opens the lead drawer for leads', () => {
    expect(resolveCreateIntent({ moduleKey: 'leads' })).toEqual({
      kind: 'quick',
      moduleKey: 'leads',
    });
  });

  it('blocks creating a History row — reactivate an existing person instead', () => {
    expect(resolveCreateIntent({ moduleKey: 'history' })).toEqual({
      kind: 'blocked',
      reason: 'history-roster',
    });
  });

  it('blocks deal create when deals are disabled', () => {
    expect(resolveCreateIntent({ moduleKey: 'deals', dealsEnabled: false })).toEqual({
      kind: 'blocked',
      reason: 'deals-disabled',
    });
  });

  it('allows the full deal form when deals are enabled', () => {
    expect(resolveCreateIntent({ moduleKey: 'deals', dealsEnabled: true })).toEqual({
      kind: 'full',
      href: '/crm/modules/deals/new',
    });
  });

  it('sends unknown modules to the full form', () => {
    expect(resolveCreateIntent({ moduleKey: 'tasks' })).toEqual({
      kind: 'full',
      href: '/crm/modules/tasks/new',
    });
  });
});

describe('originating list (D1 / TE-4)', () => {
  it('captures the module list the drawer was opened from, with its query', () => {
    expect(captureCreateOrigin('/crm/modules/contacts', '')).toBe('/crm/modules/contacts');
    expect(captureCreateOrigin('/crm/modules/contacts', '?filters=x&page=2')).toBe(
      '/crm/modules/contacts?filters=x&page=2',
    );
    expect(captureCreateOrigin('/crm/modules/members', 'view=abc')).toBe('/crm/modules/members?view=abc');
  });

  it('returns null when not opened from a module list', () => {
    expect(captureCreateOrigin('/crm', '')).toBeNull();
    expect(captureCreateOrigin('/crm/r/0000-1111', '')).toBeNull();
    expect(captureCreateOrigin('/crm/modules/contacts/new', '')).toBeNull();
    expect(captureCreateOrigin('/crm/modules/contacts/bulk-update', '')).toBeNull();
    expect(captureCreateOrigin(null, '')).toBeNull();
    expect(captureCreateOrigin('//evil.example/crm/modules/contacts', '')).toBeNull();
  });

  it('reads the module key back out of a captured origin', () => {
    expect(createOriginModuleKey('/crm/modules/members?view=x')).toBe('members');
    expect(createOriginModuleKey('/crm/modules/Contacts')).toBe('contacts');
    expect(createOriginModuleKey(null)).toBeNull();
    expect(createOriginModuleKey('/crm/r/abc')).toBeNull();
  });

  it('returns to Contacts (the hand-entry list) by default', () => {
    expect(resolveCreateReturnList({ origin: null, createdModuleKey: 'contacts' })).toEqual({
      href: '/crm/modules/contacts',
      moduleKey: 'contacts',
      membersNote: false,
    });
    // Opened from a record page / the desk → the record's own list.
    expect(resolveCreateReturnList({ origin: '/crm/r/abc', createdModuleKey: 'contacts' }).href).toBe(
      '/crm/modules/contacts',
    );
  });

  it('keeps the originating list (filters kept, page dropped) when it is the record\'s module', () => {
    expect(
      resolveCreateReturnList({
        origin: '/crm/modules/contacts?filters=pending&page=3&view=v1',
        createdModuleKey: 'contacts',
      }),
    ).toEqual({ href: '/crm/modules/contacts?filters=pending&view=v1', moduleKey: 'contacts', membersNote: false });
    expect(
      resolveCreateReturnList({ origin: '/crm/modules/contacts?page=2', createdModuleKey: 'contacts' }).href,
    ).toBe('/crm/modules/contacts');
    expect(resolveCreateReturnList({ origin: '/crm/modules/leads', createdModuleKey: 'leads' })).toEqual({
      href: '/crm/modules/leads',
      moduleKey: 'leads',
      membersNote: false,
    });
  });

  it('returns to Members with the honest note when opened from /crm/modules/members', () => {
    expect(resolveCreateReturnList({ origin: '/crm/modules/members', createdModuleKey: 'contacts' })).toEqual({
      href: '/crm/modules/members',
      moduleKey: 'members',
      membersNote: true,
    });
  });

  it('goes to the record\'s own list when the origin list is a different module', () => {
    // Lead drawer tab used from the Contacts list: the lead is not on Contacts.
    expect(resolveCreateReturnList({ origin: '/crm/modules/contacts', createdModuleKey: 'leads' })).toEqual({
      href: '/crm/modules/leads',
      moduleKey: 'leads',
      membersNote: false,
    });
    expect(resolveCreateReturnList({ origin: '/crm/modules/members', createdModuleKey: 'leads' }).href).toBe(
      '/crm/modules/leads',
    );
  });
});
