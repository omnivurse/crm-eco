import { describe, expect, it } from 'vitest';
import {
  QUICK_CREATE_FIELDS,
  buildQuickCreateDraft,
  buildQuickCreatePayload,
  fullCreateFormHref,
  initialQuickCreateValues,
  isQuickCreateDirty,
  isQuickCreateModuleKey,
  missingRequiredQuickCreateFields,
  normalizePhoneDigits,
  phoneLookupVariants,
  quickCreateDraftStorageKey,
  quickCreatePendingNeedsEffectiveDate,
} from './quick-create-config';

describe('QUICK_CREATE_FIELDS', () => {
  it('contacts = Add Member with the paste-order keys the client uses', () => {
    const cfg = QUICK_CREATE_FIELDS.contacts;
    expect(cfg.title).toBe('Add Member');
    expect(cfg.fields.map((f) => f.key)).toEqual([
      'first_name',
      'last_name',
      'phone',
      'email',
      'date_of_birth',
      'mailing_city',
      'mailing_state',
      'product',
      'sharing_effective_date',
      'producer_name',
      'referring_member',
      'member_number',
      'contact_status',
      'sharing_entity',
    ]);
    // Only names are required — email is optional for hand-entered members.
    expect(cfg.fields.filter((f) => f.required).map((f) => f.key)).toEqual([
      'first_name',
      'last_name',
    ]);
    const producer = cfg.fields.find((f) => f.key === 'producer_name');
    expect(producer?.label).toBe('Producer Name');
    expect(producer?.hint).toBe('Who enrolled');
    expect(cfg.fields.find((f) => f.key === 'contact_status')?.defaultValue).toBe('Pending');
    expect(cfg.fields.find((f) => f.key === 'sharing_entity')?.optionalIfNoOptions).toBe(true);
  });

  it('leads use the lead-equivalent keys', () => {
    const keys = QUICK_CREATE_FIELDS.leads.fields.map((f) => f.key);
    expect(keys).toContain('city');
    expect(keys).toContain('state');
    expect(keys).toContain('product_type');
    expect(keys).toContain('producer');
    expect(keys).toContain('lead_status');
    expect(keys).not.toContain('mailing_city');
    expect(keys).not.toContain('member_number');
  });

  it('never defines a deals config', () => {
    expect(isQuickCreateModuleKey('deals')).toBe(false);
    expect(isQuickCreateModuleKey('contacts')).toBe(true);
    expect(isQuickCreateModuleKey(null)).toBe(false);
  });
});

describe('initial values / dirty tracking', () => {
  it('seeds only select defaults', () => {
    expect(initialQuickCreateValues('contacts')).toEqual({ contact_status: 'Pending' });
    expect(initialQuickCreateValues('leads')).toEqual({ lead_status: 'New' });
    expect(initialQuickCreateValues('accounts')).toEqual({});
  });

  it('is not dirty on defaults, dirty once the user types', () => {
    expect(isQuickCreateDirty('contacts', initialQuickCreateValues('contacts'))).toBe(false);
    expect(isQuickCreateDirty('contacts', { contact_status: 'Pending', first_name: ' ' })).toBe(false);
    expect(isQuickCreateDirty('contacts', { contact_status: 'Pending', first_name: 'A' })).toBe(true);
    expect(isQuickCreateDirty('contacts', { contact_status: 'Active' })).toBe(true);
  });
});

describe('validation helpers', () => {
  it('reports blank required labels', () => {
    expect(missingRequiredQuickCreateFields('contacts', {})).toEqual(['First name', 'Last name']);
    expect(missingRequiredQuickCreateFields('contacts', { first_name: 'A', last_name: ' ' })).toEqual([
      'Last name',
    ]);
    expect(missingRequiredQuickCreateFields('contacts', { first_name: 'A', last_name: 'B' })).toEqual([]);
  });

  it('flags Pending without an effective date (server invariant)', () => {
    expect(
      quickCreatePendingNeedsEffectiveDate('contacts', { contact_status: 'Pending' }),
    ).toBe(true);
    expect(
      quickCreatePendingNeedsEffectiveDate('contacts', {
        contact_status: 'Pending',
        sharing_effective_date: '09/01/2026',
      }),
    ).toBe(false);
    expect(quickCreatePendingNeedsEffectiveDate('contacts', { contact_status: 'Active' })).toBe(false);
    expect(quickCreatePendingNeedsEffectiveDate('leads', { lead_status: 'Pending' })).toBe(true);
    expect(quickCreatePendingNeedsEffectiveDate('accounts', {})).toBe(false);
  });
});

describe('phone helpers', () => {
  it('normalises to digits and drops a leading US 1', () => {
    expect(normalizePhoneDigits('(555) 123-4567')).toBe('5551234567');
    expect(normalizePhoneDigits('+1 555.123.4567')).toBe('5551234567');
    expect(normalizePhoneDigits('')).toBe('');
    expect(normalizePhoneDigits(null)).toBe('');
  });

  it('produces every stored shape for a 10-digit number, as-typed first, deduped', () => {
    expect(phoneLookupVariants('555-123-4567')).toEqual([
      '555-123-4567',
      '5551234567',
      '(555) 123-4567',
    ]);
    expect(phoneLookupVariants('5551234567')).toEqual([
      '5551234567',
      '555-123-4567',
      '(555) 123-4567',
    ]);
    expect(phoneLookupVariants('12345')).toEqual(['12345']);
    expect(phoneLookupVariants('   ')).toEqual([]);
  });
});

describe('buildQuickCreatePayload', () => {
  it('trims, drops blanks, masks dates, keeps typed values otherwise', () => {
    const payload = buildQuickCreatePayload('contacts', {
      first_name: ' Jane ',
      last_name: 'Doe',
      email: '',
      phone: '  ',
      date_of_birth: '02151982',
      sharing_effective_date: '09/01/2026',
      contact_status: 'Pending',
      unknown_key: 'ignored',
    });
    expect(payload).toEqual({
      first_name: 'Jane',
      last_name: 'Doe',
      date_of_birth: '02/15/1982',
      sharing_effective_date: '09/01/2026',
      contact_status: 'Pending',
    });
    expect('email' in payload).toBe(false);
  });
});

describe('draft handoff', () => {
  it('builds the exact DraftPayload shape with blanks removed', () => {
    const draft = buildQuickCreateDraft(
      { first_name: 'Jane', last_name: '', phone: ' 555 ', contact_status: 'Pending' },
      1234,
    );
    expect(draft).toEqual({
      updatedAt: 1234,
      values: { first_name: 'Jane', phone: '555', contact_status: 'Pending' },
    });
    // JSON round-trip matches what RecordDraftAutosave.readDraft validates
    const parsed = JSON.parse(JSON.stringify(draft));
    expect(typeof parsed.updatedAt).toBe('number');
    expect(typeof parsed.values).toBe('object');
  });

  it('scopes the storage key by org like the new-record page does', () => {
    expect(quickCreateDraftStorageKey('contacts', 'org-1')).toBe('crm:newdraft:org-1:contacts');
    expect(quickCreateDraftStorageKey('leads')).toBe('crm:newdraft:leads');
    expect(quickCreateDraftStorageKey('leads', null)).toBe('crm:newdraft:leads');
  });

  it('points at the full form route', () => {
    expect(fullCreateFormHref('contacts')).toBe('/crm/modules/contacts/new');
  });
});
