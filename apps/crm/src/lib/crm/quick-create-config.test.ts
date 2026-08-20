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
  nextQuickCreateBatchValues,
  normalizeDuplicateName,
  normalizePhoneDigits,
  phoneLookupVariants,
  quickCreateDraftStorageKey,
  quickCreateFilledEffectiveDateKey,
  quickCreatePendingNeedsEffectiveDate,
  quickCreateSuggestKeys,
  quickCreateTypedName,
  splitQuickCreateDuplicates,
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
      'health_insurance_plan_name',
      'health_insurance_start_date',
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
    expect(producer?.label).toBe('Enrolled by');
    expect(producer?.hint).toBe('Who enrolled');
    expect(cfg.fields.find((f) => f.key === 'health_insurance_plan_name')?.label).toBe(
      'Health Insurance Plan',
    );
    expect(cfg.fields.find((f) => f.key === 'product')?.label).toBe(
      'Health Sharing Membership',
    );
    expect(cfg.fields.find((f) => f.key === 'sharing_effective_date')?.label).toBe(
      'Sharing effective date',
    );
    expect(cfg.fields.find((f) => f.key === 'contact_status')?.defaultValue).toBe('Pending');
    expect(cfg.fields.find((f) => f.key === 'sharing_entity')?.optionalIfNoOptions).toBe(true);
    // Taxonomy inputs: State is a US-state select, Plan/Producer get datalists.
    expect(cfg.fields.find((f) => f.key === 'mailing_state')?.type).toBe('state');
    expect(cfg.fields.find((f) => f.key === 'product')?.type).toBe('suggest');
    expect(cfg.fields.find((f) => f.key === 'health_insurance_plan_name')?.type).toBe('suggest');
    expect(cfg.fields.find((f) => f.key === 'producer_name')?.type).toBe('suggest');
    expect(cfg.batchStickyKeys).toEqual(['producer_name', 'sharing_entity', 'contact_status', 'mailing_state']);
    expect(quickCreateSuggestKeys('contacts')).toEqual([
      'health_insurance_plan_name',
      'product',
      'producer_name',
    ]);
  });

  it('leads use insurance plan + HS membership keys (not product_type as Plan)', () => {
    const keys = QUICK_CREATE_FIELDS.leads.fields.map((f) => f.key);
    expect(keys).toContain('city');
    expect(keys).toContain('state');
    expect(keys).toContain('health_insurance_plan_name');
    expect(keys).toContain('health_insurance_start_date');
    expect(keys).toContain('product_type');
    expect(keys).toContain('producer');
    expect(keys).toContain('lead_status');
    expect(keys).not.toContain('mailing_city');
    expect(keys).not.toContain('member_number');
    const cfg = QUICK_CREATE_FIELDS.leads;
    expect(cfg.fields.find((f) => f.key === 'health_insurance_plan_name')?.label).toBe(
      'Health Insurance Plan',
    );
    expect(cfg.fields.find((f) => f.key === 'product_type')?.label).toBe(
      'Health Sharing Membership',
    );
    expect(cfg.fields.find((f) => f.key === 'producer')?.label).toBe('Enrolled by');
    expect(cfg.effectiveDateKeys).toEqual([
      'health_insurance_start_date',
      'sharing_effective_date',
    ]);
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

  it('accepts a baseline so sticky batch fields do not count as dirty', () => {
    const baseline = { contact_status: 'Active', producer_name: 'Jo Rep' };
    expect(isQuickCreateDirty('contacts', { ...baseline }, baseline)).toBe(false);
    expect(isQuickCreateDirty('contacts', { ...baseline, first_name: 'A' }, baseline)).toBe(true);
    expect(isQuickCreateDirty('contacts', { ...baseline, producer_name: 'Other' }, baseline)).toBe(true);
  });
});

describe('nextQuickCreateBatchValues (Save & add another)', () => {
  it('keeps producer / sharing entity / status / state and clears the rest', () => {
    const next = nextQuickCreateBatchValues('contacts', {
      first_name: 'Jane',
      last_name: 'Doe',
      phone: '555-123-4567',
      email: 'jane@example.com',
      mailing_city: 'Denver',
      mailing_state: 'CO',
      product: 'Sedera Select',
      producer_name: 'Jo Rep',
      sharing_entity: 'Sedera',
      contact_status: 'Active',
      member_number: '1234567',
    });
    expect(next).toEqual({
      producer_name: 'Jo Rep',
      sharing_entity: 'Sedera',
      contact_status: 'Active',
      mailing_state: 'CO',
    });
  });

  it('falls back to the select default when a sticky field was blank', () => {
    expect(nextQuickCreateBatchValues('contacts', { first_name: 'A', producer_name: '  ' })).toEqual({
      contact_status: 'Pending',
    });
    expect(nextQuickCreateBatchValues('leads', { producer: 'P', state: 'TX', lead_status: 'New' })).toEqual({
      producer: 'P',
      state: 'TX',
      lead_status: 'New',
    });
    expect(nextQuickCreateBatchValues('accounts', { name: 'Acme' })).toEqual({});
  });
});

describe('duplicate pre-check parity (record-create-service rule)', () => {
  const cands = [
    { id: 'a', title: 'Jane Doe', email: 'j@x.com', phone: null },
    { id: 'b', title: 'Timmy  Doe', email: 'j@x.com', phone: null },
    { id: 'c', title: null, email: null, phone: '5551234567' },
  ];

  it('normalises names the same way as the server', () => {
    expect(normalizeDuplicateName('  Jane   DOE ')).toBe('jane doe');
    expect(normalizeDuplicateName(null)).toBe('');
    expect(quickCreateTypedName({ first_name: ' Jane', last_name: 'Doe ' })).toBe('jane doe');
    expect(quickCreateTypedName({ name: 'Acme Co' })).toBe('acme co');
    expect(quickCreateTypedName({})).toBe('');
  });

  it('blocks only when the candidate name equals the typed first+last', () => {
    const split = splitQuickCreateDuplicates({ first_name: 'jane', last_name: 'doe' }, cands);
    expect(split.blocking.map((c) => c.id)).toEqual(['a']);
    expect(split.soft.map((c) => c.id)).toEqual(['b', 'c']);
  });

  it('treats a family member sharing the email as a soft hint', () => {
    const split = splitQuickCreateDuplicates({ first_name: 'Timmy', last_name: 'Doe' }, cands);
    expect(split.blocking.map((c) => c.id)).toEqual(['b']);
    expect(split.soft.map((c) => c.id)).toEqual(['a', 'c']);
  });

  it('with no name typed yet every candidate blocks (matches `!newName ||`)', () => {
    const split = splitQuickCreateDuplicates({}, cands);
    expect(split.blocking).toHaveLength(3);
    expect(split.soft).toEqual([]);
  });

  it('handles an empty candidate list', () => {
    expect(splitQuickCreateDuplicates({ first_name: 'A', last_name: 'B' }, [])).toEqual({
      blocking: [],
      soft: [],
    });
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
    expect(
      quickCreatePendingNeedsEffectiveDate('contacts', {
        contact_status: 'Pending',
        health_insurance_start_date: '09/01/2026',
      }),
    ).toBe(false);
    expect(quickCreatePendingNeedsEffectiveDate('contacts', { contact_status: 'Active' })).toBe(false);
    expect(quickCreatePendingNeedsEffectiveDate('leads', { lead_status: 'Pending' })).toBe(true);
    expect(quickCreatePendingNeedsEffectiveDate('accounts', {})).toBe(false);
    expect(
      quickCreateFilledEffectiveDateKey('leads', {
        health_insurance_start_date: '09/01/2026',
        sharing_effective_date: '10/01/2026',
      }),
    ).toBe('health_insurance_start_date');
    expect(
      quickCreateFilledEffectiveDateKey('leads', { sharing_effective_date: '10/01/2026' }),
    ).toBe('sharing_effective_date');
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
