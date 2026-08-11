import { describe, expect, it } from 'vitest';
import { mergeCrmRecordRowIntoFormDefaults } from './record-form-defaults';

describe('mergeCrmRecordRowIntoFormDefaults status overlay', () => {
  it('overlays row status onto lead_status for leads', () => {
    const form = mergeCrmRecordRowIntoFormDefaults(
      {
        status: 'Active',
        data: { lead_status: 'Not Contacted', email: 'a@b.com' },
      },
      { moduleKey: 'leads' },
    );
    expect(form.lead_status).toBe('Active');
    expect(form.status).toBe('Active');
  });

  it('overlays contact_status and strips stale lead_status for contacts', () => {
    const form = mergeCrmRecordRowIntoFormDefaults(
      {
        status: 'Active',
        data: { lead_status: 'Converted', contact_status: 'Pending' },
      },
      { moduleKey: 'contacts' },
    );
    expect(form.contact_status).toBe('Active');
    expect(form.lead_status).toBeUndefined();
  });
});

describe('mergeCrmRecordRowIntoFormDefaults null indexed columns', () => {
  it('does not let NULL indexed columns wipe populated JSONB values', () => {
    const form = mergeCrmRecordRowIntoFormDefaults(
      {
        cancellation_date: null,
        carrier_id: null,
        original_start_date: null,
        group_name: null,
        tobacco_user: null,
        data: {
          cancellation_date: '2024-06-01',
          carrier_id: '11111111-1111-1111-1111-111111111111',
          original_start_date: '2021-06-01',
          group_name: 'Acme Group',
          tobacco_user: true,
        },
      },
      { moduleKey: 'contacts' },
    );
    expect(form.cancellation_date).toBe('2024-06-01');
    expect(form.carrier_id).toBe('11111111-1111-1111-1111-111111111111');
    expect(form.original_start_date).toBe('2021-06-01');
    expect(form.group_name).toBe('Acme Group');
    expect(form.tobacco_user).toBe(true);
  });

  it('still lets non-null indexed columns override stale JSONB', () => {
    const form = mergeCrmRecordRowIntoFormDefaults(
      {
        cancellation_date: '2025-01-15',
        tobacco_user: false,
        group_name: 'Indexed Group',
        data: {
          cancellation_date: '2020-01-01',
          tobacco_user: true,
          group_name: 'Json Group',
        },
      },
      { moduleKey: 'contacts' },
    );
    expect(form.cancellation_date).toBe('2025-01-15');
    expect(form.tobacco_user).toBe(false);
    expect(form.group_name).toBe('Indexed Group');
  });

  it('does not treat empty-string indexed columns as authoritative', () => {
    const form = mergeCrmRecordRowIntoFormDefaults(
      {
        group_name: '   ',
        data: { group_name: 'Kept From Json' },
      },
      { moduleKey: 'contacts' },
    );
    expect(form.group_name).toBe('Kept From Json');
  });
});
