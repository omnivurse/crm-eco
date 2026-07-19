import { describe, expect, it } from 'vitest';
import {
  applyStatusToRecordUpdates,
  patchTouchesStatus,
  statusJsonbFieldKey,
} from './status-sync';
import {
  mergeCrmDataJsonIntoRowColumns,
  pickUpdateMirrorColumns,
} from './merge-crm-data-json-to-row';

describe('statusJsonbFieldKey', () => {
  it('uses lead_status for leads', () => {
    expect(statusJsonbFieldKey('leads')).toBe('lead_status');
  });
  it('uses contact_status for contacts/members/other', () => {
    expect(statusJsonbFieldKey('contacts')).toBe('contact_status');
    expect(statusJsonbFieldKey('members')).toBe('contact_status');
    expect(statusJsonbFieldKey('deals')).toBe('contact_status');
  });
});

describe('applyStatusToRecordUpdates', () => {
  it('writes column + lead_status for leads', () => {
    const updates: Record<string, unknown> = {};
    applyStatusToRecordUpdates(updates, 'Active', 'leads', {
      lead_status: 'Not Contacted',
      email: 'a@b.com',
    });
    expect(updates.status).toBe('Active');
    expect(updates.data).toEqual({
      lead_status: 'Active',
      email: 'a@b.com',
    });
  });

  it('writes contact_status and strips lead_status for contacts', () => {
    const updates: Record<string, unknown> = {};
    applyStatusToRecordUpdates(updates, 'Active', 'contacts', {
      lead_status: 'Converted',
      contact_status: 'Pending',
    });
    expect(updates.status).toBe('Active');
    const data = updates.data as Record<string, unknown>;
    expect(data.contact_status).toBe('Active');
    expect(data.lead_status).toBeUndefined();
  });
});

describe('PATCH remirror clobber guard (Wave 1)', () => {
  it('does not remirror stale JSONB status onto the row when patch omits status keys', () => {
    const mergedData = {
      email: 'new@x.com',
      lead_status: 'Not Contacted', // stale after Kanban moved row to Active
    };
    const mirrored = mergeCrmDataJsonIntoRowColumns(mergedData, {
      moduleKey: 'leads',
      previousTitle: 'Jane',
    });
    expect(mirrored.status).toBe('Not Contacted');
    const safe = pickUpdateMirrorColumns(mirrored, [], []);
    expect(safe.status).toBeUndefined();
    expect(safe.email).toBe('new@x.com');
  });

  it('allows status remirror when patch intentionally sets lead_status', () => {
    const patch = { lead_status: 'Active' };
    const mergedData = { lead_status: 'Active', email: 'a@b.com' };
    const mirrored = mergeCrmDataJsonIntoRowColumns(mergedData, {
      moduleKey: 'leads',
    });
    const allowKeys = patchTouchesStatus(patch) ? ['status'] : [];
    const safe = pickUpdateMirrorColumns(mirrored, [], allowKeys);
    expect(safe.status).toBe('Active');
  });

  it('does not remirror stale advisor_id on unrelated field save', () => {
    const mergedData = {
      phone: '303',
      advisor_id: 'stale-adv',
    };
    const mirrored = mergeCrmDataJsonIntoRowColumns(mergedData, {
      moduleKey: 'leads',
    });
    const safe = pickUpdateMirrorColumns(mirrored);
    expect(safe.advisor_id).toBeUndefined();
    expect(safe.phone).toBe('303');
  });
});
