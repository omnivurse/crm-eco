import { describe, expect, it } from 'vitest';
import {
  categorizeSearchField,
  humanizeFieldKey,
  getRecordSearchMatches,
  findQueryRanges,
  toHighlightSegments,
  SEARCH_MATCH_COLORS,
} from './search-match';

describe('categorizeSearchField', () => {
  it('routes common keys to the right colour category', () => {
    expect(categorizeSearchField('email')).toBe('email');
    expect(categorizeSearchField('work_phone')).toBe('phone');
    expect(categorizeSearchField('mobile')).toBe('phone');
    expect(categorizeSearchField('company_name')).toBe('company');
    expect(categorizeSearchField('account_name')).toBe('company');
    expect(categorizeSearchField('member_number')).toBe('id');
    expect(categorizeSearchField('account_number')).toBe('id');
    expect(categorizeSearchField('first_name')).toBe('name');
    expect(categorizeSearchField('title')).toBe('name');
    expect(categorizeSearchField('lead_status')).toBe('status');
    expect(categorizeSearchField('state')).toBe('address');
    expect(categorizeSearchField('city')).toBe('address');
    expect(categorizeSearchField('date_of_birth')).toBe('date');
    expect(categorizeSearchField('created_at')).toBe('date');
    expect(categorizeSearchField('some_custom_field')).toBe('other');
  });

  it('does not confuse "status" for the "state" address token', () => {
    expect(categorizeSearchField('status')).toBe('status');
    expect(categorizeSearchField('contact_status')).toBe('status');
  });

  it('every category has a colour token', () => {
    for (const cat of [
      'name',
      'email',
      'phone',
      'company',
      'status',
      'address',
      'id',
      'date',
      'other',
    ] as const) {
      expect(SEARCH_MATCH_COLORS[cat]).toBeTruthy();
      expect(SEARCH_MATCH_COLORS[cat].chip).toContain('bg-');
      expect(SEARCH_MATCH_COLORS[cat].mark).toContain('bg-');
    }
  });
});

describe('humanizeFieldKey', () => {
  it('prefers curated labels, humanizes the rest', () => {
    expect(humanizeFieldKey('member_number')).toBe('Member ID');
    expect(humanizeFieldKey('first_name')).toBe('First name');
    expect(humanizeFieldKey('preferred_carrier')).toBe('Preferred Carrier');
  });
});

describe('findQueryRanges + toHighlightSegments', () => {
  it('highlights every occurrence, case-insensitively', () => {
    const ranges = findQueryRanges('Acme Health (acme)', 'acme');
    expect(ranges).toHaveLength(2);
    const segs = toHighlightSegments('Acme Health (acme)', ranges);
    const highlighted = segs.filter((s) => s.match).map((s) => s.text);
    expect(highlighted).toEqual(['Acme', 'acme']);
  });

  it('merges overlapping/adjacent ranges from multiple terms', () => {
    // "john" and "ohn" overlap; must not double-wrap
    const ranges = findQueryRanges('Johnathan', 'john ohn');
    expect(ranges).toHaveLength(1);
    const segs = toHighlightSegments('Johnathan', ranges);
    expect(segs.map((s) => s.text).join('')).toBe('Johnathan');
  });

  it('returns the whole string as one plain segment when nothing matches', () => {
    const segs = toHighlightSegments('nothing here', []);
    expect(segs).toEqual([{ text: 'nothing here', match: false }]);
  });

  it('clamps ranges that fall outside the value (defensive)', () => {
    // A range past the end must not throw or slice garbage.
    const segs = toHighlightSegments('short', [{ start: 2, end: 999 }]);
    expect(segs.map((s) => s.text).join('')).toBe('short');
    expect(segs.some((s) => s.match)).toBe(true);
  });
});

describe('getRecordSearchMatches', () => {
  it('attributes a phone hit to the phone field with a chip', () => {
    const matches = getRecordSearchMatches(
      { title: 'Sarah Chen', phone: '(555) 0142-0088', data: {} },
      '0142',
    );
    const phone = matches.find((m) => m.category === 'phone');
    expect(phone).toBeTruthy();
    expect(phone!.ranges.length).toBeGreaterThan(0);
  });

  it('names the matched data field using its humanized label', () => {
    const matches = getRecordSearchMatches(
      { title: 'Jane Doe', data: { company_name: 'Acme Health' } },
      'acme',
    );
    const company = matches.find((m) => m.category === 'company');
    expect(company).toBeTruthy();
    expect(company!.label).toBe('Company');
    expect(company!.value).toBe('Acme Health');
  });

  it('uses provided field labels over humanized keys', () => {
    const matches = getRecordSearchMatches(
      { data: { plan_tier: 'Gold' } },
      'gold',
      { fieldLabels: { plan_tier: 'Coverage Tier' } },
    );
    expect(matches[0].label).toBe('Coverage Tier');
  });

  it('collapses redundant name-part chips (title contains first_name)', () => {
    const matches = getRecordSearchMatches(
      { title: 'John Smith', data: { first_name: 'John', last_name: 'Smith' } },
      'john',
    );
    const nameMatches = matches.filter((m) => m.category === 'name');
    // Only the title ("John Smith") survives — first_name "John" is a name part
    // contained in it. last_name "Smith" doesn't match "john" at all.
    expect(nameMatches).toHaveLength(1);
    expect(nameMatches[0].fieldKey).toBe('title');
  });

  it('keeps a distinct point-of-contact name that is not a name part', () => {
    const matches = getRecordSearchMatches(
      { title: 'Bob Jones', data: { contact_name: 'Bob' } },
      'bob',
    );
    const nameKeys = matches.filter((m) => m.category === 'name').map((m) => m.fieldKey);
    // contact_name is a *different* person, not a component of the title — keep both.
    expect(nameKeys).toContain('title');
    expect(nameKeys).toContain('contact_name');
  });

  it('keeps the match highlighted for values longer than the display cap', () => {
    const value = `${'A'.repeat(125)}needle${'B'.repeat(40)}`;
    const matches = getRecordSearchMatches({ data: { notes: value } }, 'needle');
    const notes = matches.find((m) => m.fieldKey === 'notes');
    expect(notes).toBeTruthy();
    // Windowed value stays within the cap (+ ellipses) and the highlight is intact.
    expect(notes!.ranges.length).toBeGreaterThan(0);
    const segs = toHighlightSegments(notes!.value, notes!.ranges);
    expect(segs.filter((s) => s.match).map((s) => s.text).join('')).toBe('needle');
  });

  it('does not mis-attribute a short numeric term (e.g. a year) to a phone field', () => {
    const matches = getRecordSearchMatches(
      { phone: '(202) 456-1414', data: { first_name: 'Smith' } },
      'smith 2024',
    );
    // "2024" is only 4 digits — it must not spuriously light up the phone chip.
    expect(matches.some((m) => m.category === 'phone')).toBe(false);
    expect(matches.some((m) => m.fieldKey === 'first_name')).toBe(true);
  });

  it('ignores internal bookkeeping keys', () => {
    const matches = getRecordSearchMatches(
      {
        title: 'Lead X',
        data: { is_converted: 'true', converted_contact_id: 'abc-123', notes_field: 'converted soon' },
      },
      'converted',
    );
    // is_converted / converted_contact_id must never produce a chip.
    expect(matches.every((m) => m.fieldKey !== 'is_converted')).toBe(true);
    expect(matches.every((m) => m.fieldKey !== 'converted_contact_id')).toBe(true);
    // A real custom field still matches.
    expect(matches.some((m) => m.fieldKey === 'notes_field')).toBe(true);
  });

  it('matches a formatted stored phone against digit-only query', () => {
    const matches = getRecordSearchMatches(
      { data: { mobile: '(800) 555-8888' } },
      '8005558888',
    );
    const mobile = matches.find((m) => m.fieldKey === 'mobile');
    expect(mobile).toBeTruthy();
    expect(mobile!.category).toBe('phone');
  });

  it('is robust to empty query, blank query, and odd value types', () => {
    expect(getRecordSearchMatches({ title: 'x' }, '')).toEqual([]);
    expect(getRecordSearchMatches({ title: 'x' }, '   ')).toEqual([]);
    const matches = getRecordSearchMatches(
      {
        title: 'Test',
        data: {
          tags: ['alpha', 'test-beta'],
          count: 42,
          flag: true,
          nested: { a: 1 },
          empty: null,
        },
      },
      'test',
    );
    // Array values are searchable (joined); nested objects/null are skipped safely.
    expect(matches.some((m) => m.fieldKey === 'title')).toBe(true);
    expect(() =>
      getRecordSearchMatches({ data: { nested: { deep: {} } } }, 'x'),
    ).not.toThrow();
  });

  it('respects maxMatches', () => {
    const matches = getRecordSearchMatches(
      {
        title: 'aa',
        email: 'aa@aa.com',
        phone: 'aa',
        data: { company_name: 'aa co', city: 'aa town', member_number: 'aa-1' },
      },
      'aa',
      { maxMatches: 2 },
    );
    expect(matches.length).toBeLessThanOrEqual(2);
  });
});
