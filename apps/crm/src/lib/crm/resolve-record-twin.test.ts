import { describe, it, expect } from 'vitest';
import {
  buildTwinLookup,
  collectTwinLookupKeys,
  countOverlayableKeys,
  MEMBERS_COVERAGE_LIST_ALIASES,
  overlayTwinData,
  pickRicherTwin,
  pickRicherTwinsForRows,
  projectMembersCoverageAliases,
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

// ── Batch (list-page) resolution ─────────────────────────────────────────────

const secondMemberRow = {
  id: 'member-row-2',
  email: 'Sam.Perez@Example.com',
  phone: null,
  data: { first_name: 'Sam', last_name: 'Perez', member_number: 'M-2222', city: 'Austin' },
};

const secondContactTwin = {
  id: 'contact-row-2',
  email: 'sam.perez@example.com',
  phone: null,
  data: {
    first_name: 'Sam',
    last_name: 'Perez',
    member_number: 'M-2222',
    product: 'Co-Pay Plan (27199)',
    sharing_effective_date: '2024-07-01',
    referring_member: 'Dan Dubois',
    a: 1,
    b: 2,
  },
};

const noIdentityRow = { id: 'member-row-3', data: { first_name: 'Only', last_name: 'Name' } };

describe('collectTwinLookupKeys', () => {
  it('collects deduplicated, lower-cased emails and member numbers', () => {
    const keys = collectTwinLookupKeys([thinMemberRow, secondMemberRow, secondMemberRow]);
    expect(keys.emails).toEqual(['davelung@da2ventures.com', 'sam.perez@example.com']);
    expect(keys.memberNumbers).toEqual(['677910847', 'M-2222']);
  });

  it('skips rows that have no strong identifier', () => {
    expect(collectTwinLookupKeys([noIdentityRow])).toEqual({ emails: [], memberNumbers: [] });
  });
});

describe('pickRicherTwinsForRows', () => {
  it('resolves the richer twin for every row on the page', () => {
    const map = pickRicherTwinsForRows(
      [thinMemberRow, secondMemberRow, noIdentityRow],
      [secondContactTwin, richContactTwin],
    );
    expect(map.get('member-row-1')).toBe(richContactTwin.data);
    expect(map.get('member-row-2')).toBe(secondContactTwin.data);
    expect(map.has('member-row-3')).toBe(false);
  });

  it('matches email case-insensitively (Members and Contacts emails differ in case)', () => {
    const map = pickRicherTwinsForRows([secondMemberRow], [
      { ...secondContactTwin, data: { ...secondContactTwin.data, member_number: null } },
    ]);
    expect(map.get('member-row-2')?.product).toBe('Co-Pay Plan (27199)');
  });

  it('agrees with pickRicherTwin for each row (single vs batch never disagree)', () => {
    const rows = [thinMemberRow, secondMemberRow];
    const candidates = [secondContactTwin, richContactTwin, { ...richContactTwin, id: thinMemberRow.id }];
    const map = pickRicherTwinsForRows(rows, candidates);
    for (const row of rows) {
      expect(map.get(row.id) ?? null).toBe(pickRicherTwin(row, candidates)?.data ?? null);
    }
  });

  it('never assigns a thinner candidate or a stranger', () => {
    const stranger = {
      id: 'stranger',
      email: 'someone.else@example.com',
      data: { first_name: 'Jane', last_name: 'Doe', member_number: '000000', a: 1, b: 2, c: 3 },
    };
    const thinner = { id: 'thin', email: thinMemberRow.email, data: { first_name: 'David' } };
    expect(pickRicherTwinsForRows([thinMemberRow], [stranger, thinner]).size).toBe(0);
  });

  it('never returns a row as its own twin', () => {
    const self = { ...richContactTwin, id: thinMemberRow.id };
    expect(pickRicherTwinsForRows([thinMemberRow], [self]).size).toBe(0);
  });
});

describe('projectMembersCoverageAliases', () => {
  it('fills blank plan_name / effective_date from the twin-supplied keys', () => {
    const merged = mergeCrmRecordRowIntoFormDefaults(secondMemberRow, {
      moduleKey: 'members',
      twinData: secondContactTwin.data,
    });
    const out = projectMembersCoverageAliases(merged);
    expect(out.plan_name).toBe('Co-Pay Plan (27199)');
    expect(out.effective_date).toBe('2024-07-01');
    // the twin's referring_member is a name, members' referral is a Yes/No flag
    expect(out.referral).toBeUndefined();
    expect(MEMBERS_COVERAGE_LIST_ALIASES.referral).toBeUndefined();
  });

  it('falls back to start_date when sharing_effective_date is blank', () => {
    expect(projectMembersCoverageAliases({ start_date: '2021-06-01' }).effective_date).toBe(
      '2021-06-01',
    );
  });

  it("never overwrites the row's own values and does not mutate the input", () => {
    const input = { plan_name: 'Typed by rep', product: 'Secure HSA', effective_date: '2026-07-01', start_date: '2020-01-01' };
    const out = projectMembersCoverageAliases(input);
    expect(out).toEqual(input);
    expect(input.plan_name).toBe('Typed by rep');
  });

  it('is a no-op when no alias carries a value', () => {
    expect(projectMembersCoverageAliases({ first_name: 'A' })).toEqual({ first_name: 'A' });
  });

  it('never projects a capacity label ("Health Sharing" / "Health Insurance") into plan_name', () => {
    expect(projectMembersCoverageAliases({ product: 'Health Sharing' }).plan_name).toBeUndefined();
    expect(projectMembersCoverageAliases({ product: 'Health Insurance' }).plan_name).toBeUndefined();
    // Skips the capacity alias and falls through to the next real plan alias.
    expect(
      projectMembersCoverageAliases({ product: 'Health Sharing', plan: 'Secure HSA' }).plan_name,
    ).toBe('Secure HSA');
    // A real plan name in `product` still projects.
    expect(projectMembersCoverageAliases({ product: 'Co-Pay Plan (27199)' }).plan_name).toBe(
      'Co-Pay Plan (27199)',
    );
    // effective_date has no capacity guard.
    expect(projectMembersCoverageAliases({ start_date: 'Health Sharing' }).effective_date).toBe(
      'Health Sharing',
    );
  });
});
