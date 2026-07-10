import { describe, expect, it } from 'vitest';
import { detectModule, suggestSmartMappings } from './smart-mapping';
import type { CrmField } from '@/lib/crm/types';

function field(key: string, label: string, type: CrmField['type'] = 'text'): CrmField {
  return {
    id: key,
    org_id: 'org',
    module_id: 'mod',
    key,
    label,
    type,
    required: false,
    is_system: false,
    display_order: 1,
    section: 'core',
    width: 'half',
    created_at: '',
    updated_at: '',
  } as CrmField;
}

const CONTACT_FIELDS: CrmField[] = [
  field('first_name', 'First Name'),
  field('last_name', 'Last Name'),
  field('email', 'Email'),
  field('phone', 'Phone'),
  field('mobile', 'Mobile'),
  field('mailing_zip', 'Mailing Zip'),
  field('mailing_city', 'Mailing City'),
  field('date_of_birth', 'Date of Birth', 'date'),
  field('referring_member', 'Referring Member'),
  field('referral_source', 'Referral Source'),
];

describe('suggestSmartMappings', () => {
  it('maps well-known Zoho headers to the right field keys', () => {
    const headers = [
      'First Name',
      'Last Name',
      'Email',
      'Mailing Zip',
      'Date of Birth',
      'Referring Member',
    ];
    const result = suggestSmartMappings(headers, CONTACT_FIELDS);
    const byCol = Object.fromEntries(result.map((m) => [m.sourceColumn, m.targetField]));

    expect(byCol['First Name']).toBe('first_name');
    expect(byCol['Last Name']).toBe('last_name');
    expect(byCol['Email']).toBe('email');
    expect(byCol['Mailing Zip']).toBe('mailing_zip');
    expect(byCol['Date of Birth']).toBe('date_of_birth');
    expect(byCol['Referring Member']).toBe('referring_member');
    // All of the above should clear the auto-map threshold.
    expect(result.every((m) => (m.targetField ? m.autoMapped : true))).toBe(true);
  });

  it('handles Zoho formatting noise (case / punctuation / synonyms)', () => {
    const headers = ['e-mail', 'ZIP CODE', 'Cell Phone', 'DOB', 'Referred By'];
    const byCol = Object.fromEntries(
      suggestSmartMappings(headers, CONTACT_FIELDS).map((m) => [m.sourceColumn, m.targetField]),
    );
    expect(byCol['e-mail']).toBe('email');
    expect(byCol['ZIP CODE']).toBe('mailing_zip');
    expect(byCol['Cell Phone']).toBe('mobile');
    expect(byCol['DOB']).toBe('date_of_birth');
    expect(byCol['Referred By']).toBe('referring_member');
  });

  it('skips Zoho system/export columns', () => {
    const result = suggestSmartMappings(['Record Id', 'Modified Time', 'Tag'], CONTACT_FIELDS);
    expect(result.every((m) => m.targetField === null)).toBe(true);
  });

  it('never maps two columns to the same field (strongest wins)', () => {
    const result = suggestSmartMappings(['Email', 'Email Address'], CONTACT_FIELDS);
    const mapped = result.filter((m) => m.targetField === 'email');
    expect(mapped).toHaveLength(1);
  });
});

describe('detectModule', () => {
  const available = ['contacts', 'leads', 'deals', 'accounts'];

  it('detects leads from lead-specific signals', () => {
    const d = detectModule(['Lead Status', 'Lead Source', 'Company', 'Email'], available);
    expect(d.moduleKey).toBe('leads');
  });

  it('detects deals from deal-specific signals', () => {
    const d = detectModule(['Deal Name', 'Amount', 'Closing Date', 'Stage'], available);
    expect(d.moduleKey).toBe('deals');
  });

  it('detects contacts from mailing/DOB signals', () => {
    const d = detectModule(['Contact Name', 'Mailing Street', 'Date of Birth'], available);
    expect(d.moduleKey).toBe('contacts');
  });

  it('falls back to contacts when there is no clear signal', () => {
    const d = detectModule(['Foo', 'Bar', 'Baz'], available);
    expect(d.moduleKey).toBe('contacts');
  });
});
