import { describe, expect, it } from 'vitest';
import {
  PARTNER_FIELD_KEYS,
  PARTNER_RELATIONSHIP_VALUES,
  isPartnerFieldKey,
  isPartnerRelationshipValue,
  shouldShowPartnerFieldInForm,
} from './partner-fields';

describe('isPartnerRelationshipValue', () => {
  it('accepts both partner kinds', () => {
    expect(isPartnerRelationshipValue('Partner')).toBe(true);
    expect(isPartnerRelationshipValue('Referring Partner')).toBe(true);
  });

  it('tolerates the spellings imports actually produce', () => {
    expect(isPartnerRelationshipValue('  referring   partner ')).toBe(true);
    expect(isPartnerRelationshipValue('PARTNER')).toBe(true);
  });

  it('rejects the neighbouring relationship values it must not absorb', () => {
    // These predate Partner and mean something narrower — the 111 records on
    // Provider / DPC Provider stay exactly where they are.
    for (const v of ['Member', 'Advisor', 'Agency', 'DPC Provider', 'Provider', 'Employee', 'Personal']) {
      expect(isPartnerRelationshipValue(v)).toBe(false);
    }
  });

  it('rejects blanks and non-strings', () => {
    expect(isPartnerRelationshipValue('')).toBe(false);
    expect(isPartnerRelationshipValue('   ')).toBe(false);
    expect(isPartnerRelationshipValue(null)).toBe(false);
    expect(isPartnerRelationshipValue(undefined)).toBe(false);
    expect(isPartnerRelationshipValue(42)).toBe(false);
  });
});

describe('isPartnerFieldKey', () => {
  it('covers exactly the partner section', () => {
    for (const key of PARTNER_FIELD_KEYS) expect(isPartnerFieldKey(key)).toBe(true);
    expect(isPartnerFieldKey('relationship_type')).toBe(false);
    expect(isPartnerFieldKey('partners')).toBe(false); // legacy free-text field
    expect(isPartnerFieldKey('referring_member')).toBe(false);
  });
});

describe('shouldShowPartnerFieldInForm', () => {
  it('never narrows a field outside the partner section', () => {
    expect(shouldShowPartnerFieldInForm({ fieldKey: 'email', values: {} })).toBe(true);
    expect(shouldShowPartnerFieldInForm({ fieldKey: 'email', values: null })).toBe(true);
  });

  it('hides partner fields on an untagged contact', () => {
    // The 15,627 blank-relationship contacts must not grow an empty card.
    const blank = { first_name: 'Jane', relationship_type: '' };
    for (const key of PARTNER_FIELD_KEYS) {
      expect(shouldShowPartnerFieldInForm({ fieldKey: key, values: blank })).toBe(false);
    }
  });

  it('hides partner fields on an Advisor', () => {
    expect(
      shouldShowPartnerFieldInForm({
        fieldKey: 'partner_industry',
        values: { relationship_type: 'Advisor' },
      }),
    ).toBe(false);
  });

  it('shows partner fields once the record is tagged', () => {
    for (const relationship of PARTNER_RELATIONSHIP_VALUES) {
      for (const key of PARTNER_FIELD_KEYS) {
        expect(
          shouldShowPartnerFieldInForm({ fieldKey: key, values: { relationship_type: relationship } }),
        ).toBe(true);
      }
    }
  });

  it('Robin Anderson: Referring Partner reveals the industry field', () => {
    const robin = {
      first_name: 'Robin',
      last_name: 'Anderson',
      company: 'Wealth Strategies',
      relationship_type: 'Referring Partner',
    };
    expect(shouldShowPartnerFieldInForm({ fieldKey: 'partner_industry', values: robin })).toBe(true);
  });

  it('never hides a partner field that already holds a value', () => {
    // A mis-tagged (or later re-tagged) record must not swallow stored data.
    const stranded = { relationship_type: 'Member', partner_industry: 'Financial Advisor / Wealth Management' };
    expect(shouldShowPartnerFieldInForm({ fieldKey: 'partner_industry', values: stranded })).toBe(true);
    expect(shouldShowPartnerFieldInForm({ fieldKey: 'partner_since', values: stranded })).toBe(false);
  });

  it('treats an empty multiselect array as unset', () => {
    const empty = { relationship_type: 'Member', partner_services: [] };
    expect(shouldShowPartnerFieldInForm({ fieldKey: 'partner_services', values: empty })).toBe(false);
    const filled = { relationship_type: 'Member', partner_services: ['MEC'] };
    expect(shouldShowPartnerFieldInForm({ fieldKey: 'partner_services', values: filled })).toBe(true);
  });
});
