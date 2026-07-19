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
