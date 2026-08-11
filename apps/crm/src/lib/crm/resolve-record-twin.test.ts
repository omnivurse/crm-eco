import { describe, it, expect } from 'vitest';
import {
  buildTwinLookup,
  countOverlayableKeys,
  overlayTwinData,
  pickRicherTwin,
  TWIN_OVERLAY_EXCLUDED_KEYS,
} from './resolve-record-twin';
import { mergeCrmRecordRowIntoFormDefaults } from './record-form-defaults';

/** Shapes mirror real PIF-ECO-V2 rows (David Lung has a thin Members twin). */
const thinMemberRow = {
  id: 'member-row-1',
  email: 'davelung@da2ventures.com',
  phone: '970-779-4782',
  data: {
    first_name: 'David',
    last_name: 'Lung',
    member_number: '677910847',
    city: 'Timnath',
    advisor_id: 'advisor-only-on-member',
  },
};

const richContactTwin = {
  id: 'contact-row-1',
  email: 'davelung@da2ventures.com',
  phone: '970-779-4782',
  module_key: 'contacts',
  data: {
    first_name: 'David',
    last_name: 'Lung',
    member_number: '677910847',
    city: 'Timnath',
    carrier: 'Zion Health',
    product: 'Secure HSA (45800)',
    start_date: '2021-06-01',
    monthly_premium: 448,
    spouse: 'Holly Lung',
    mailing_street: '3970 Ridgeline Dr',
    zoho_record_id: 'zcrm_999',
    created_by_name: 'Wendy Scipione',
    linked_member_id: 'some-other-member',
    advisor_id: 'advisor-on-contact',
  },
};

describe('buildTwinLookup', () => {
  it('builds a lookup from member number and email', () => {
    const lookup = buildTwinLookup(thinMemberRow);
    expect(lookup).toMatchObject({
      member_number: '677910847',
      email: 'davelung@da2ventures.com',
      first_name: 'David',
      last_name: 'Lung',
    });
  });

  it('refuses to match on name alone', () => {
    expect(
      buildTwinLookup({ id: 'x', data: { first_name: 'John', last_name: 'Smith' } }),
    ).toBeNull();
  });

  it('returns null for an empty record', () => {
    expect(buildTwinLookup({ id: 'x', data: {} })).toBeNull();
    expect(buildTwinLookup({ id: 'x', data: null })).toBeNull();
  });
});

describe('pickRicherTwin', () => {
  it('finds the richer contact twin for a thin member row', () => {
    expect(pickRicherTwin(thinMemberRow, [richContactTwin])?.id).toBe('contact-row-1');
  });

  it('never matches a row against itself', () => {
    const self = { ...richContactTwin, id: thinMemberRow.id };
    expect(pickRicherTwin(thinMemberRow, [self])).toBeNull();
  });

  it('refuses a twin that is thinner than the record itself', () => {
    const thinner = { id: 'other', email: thinMemberRow.email, data: { first_name: 'David' } };
    expect(pickRicherTwin(thinMemberRow, [thinner])).toBeNull();
  });

  it('does not match a different person who shares nothing identifying', () => {
    const stranger = {
      id: 'stranger',
      email: 'someone.else@example.com',
      data: { first_name: 'Jane', last_name: 'Doe', member_number: '000000', a: 1, b: 2, c: 3, d: 4 },
    };
    expect(pickRicherTwin(thinMemberRow, [stranger])).toBeNull();
  });

  it('picks the richest when several twins match', () => {
    const middling = {
      id: 'mid',
      email: thinMemberRow.email,
      data: { first_name: 'David', last_name: 'Lung', carrier: 'Zion Health' },
    };
    expect(pickRicherTwin(thinMemberRow, [middling, richContactTwin])?.id).toBe('contact-row-1');
  });
});

describe('overlayTwinData', () => {
  it('fills blanks from the twin', () => {
    const out = overlayTwinData(thinMemberRow.data, richContactTwin.data);
    expect(out.carrier).toBe('Zion Health');
    expect(out.start_date).toBe('2021-06-01');
    expect(out.spouse).toBe('Holly Lung');
  });

  it("never overrides the record's own populated values", () => {
    const out = overlayTwinData(thinMemberRow.data, richContactTwin.data);
    expect(out.advisor_id).toBe('advisor-only-on-member');
    expect(out.city).toBe('Timnath');
  });

  it('never copies record-scoped provenance or cross-record pointers', () => {
    const out = overlayTwinData(thinMemberRow.data, richContactTwin.data);
    for (const key of ['zoho_record_id', 'created_by_name', 'linked_member_id']) {
      expect(TWIN_OVERLAY_EXCLUDED_KEYS.has(key)).toBe(true);
      expect(out[key]).toBeUndefined();
    }
  });

  it('does not mutate either input', () => {
    const base = { ...thinMemberRow.data };
    const twin = { ...richContactTwin.data };
    overlayTwinData(base, twin);
    expect(base).toEqual(thinMemberRow.data);
    expect(twin).toEqual(richContactTwin.data);
  });

  it('treats blank strings and empty arrays as fillable', () => {
    const out = overlayTwinData({ a: '', b: [], c: '  ' }, { a: 'x', b: ['y'], c: 'z' });
    expect(out).toEqual({ a: 'x', b: ['y'], c: 'z' });
  });

  it('is a no-op without a twin', () => {
    expect(overlayTwinData(thinMemberRow.data, null)).toEqual(thinMemberRow.data);
  });
});

describe('countOverlayableKeys', () => {
  it('ignores excluded and blank keys', () => {
    expect(countOverlayableKeys({ a: 1, zoho_record_id: 'z', blank: '', missing: null })).toBe(1);
  });
});

describe('mergeCrmRecordRowIntoFormDefaults with a twin', () => {
  it('surfaces twin coverage data on the thin member record', () => {
    const merged = mergeCrmRecordRowIntoFormDefaults(thinMemberRow, {
      moduleKey: 'members',
      twinData: richContactTwin.data,
    });
    expect(merged.carrier).toBe('Zion Health');
    expect(merged.start_date).toBe('2021-06-01');
    // carrier bridges through to the Health Share section field
    expect(merged.sharing_entity).toBe('Zion Health');
  });

  it('keeps indexed columns authoritative over the twin', () => {
    const merged = mergeCrmRecordRowIntoFormDefaults(
      { ...thinMemberRow, market_type: 'healthshare', status: 'Active' },
      { moduleKey: 'members', twinData: { ...richContactTwin.data, market_type: 'insurance' } },
    );
    expect(merged.market_type).toBe('healthshare');
    expect(merged.status).toBe('Active');
  });

  it('is byte-identical to the old behavior when no twin is passed', () => {
    const without = mergeCrmRecordRowIntoFormDefaults(thinMemberRow, { moduleKey: 'members' });
    const withNull = mergeCrmRecordRowIntoFormDefaults(thinMemberRow, {
      moduleKey: 'members',
      twinData: null,
    });
    expect(withNull).toEqual(without);
    expect(without.carrier).toBeUndefined();
  });
});
