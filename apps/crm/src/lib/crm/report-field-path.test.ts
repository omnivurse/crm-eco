import { describe, expect, it } from 'vitest';
import { resolveCrmRecordFilterField } from './report-field-path';

describe('resolveCrmRecordFilterField', () => {
  it('maps legacy start_date to indexed original_start_date on crm_records', () => {
    expect(resolveCrmRecordFilterField('start_date', 'crm_records')).toBe('original_start_date');
  });

  it('uses JSONB path for custom module fields', () => {
    expect(resolveCrmRecordFilterField('health_insurance_start_date', 'crm_records')).toBe(
      'data->>health_insurance_start_date',
    );
  });

  it('maps contact_status and lead_status to indexed status column', () => {
    expect(resolveCrmRecordFilterField('contact_status', 'crm_records')).toBe('status');
    expect(resolveCrmRecordFilterField('lead_status', 'crm_records')).toBe('status');
  });

  it('passes through system columns unchanged', () => {
    expect(resolveCrmRecordFilterField('status', 'crm_records')).toBe('status');
  });
});
