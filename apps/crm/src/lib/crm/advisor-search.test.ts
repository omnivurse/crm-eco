import { describe, expect, it } from 'vitest';
import { PRODUCER_SEARCH_COLUMNS, advisorSearchOrFilter, producerDisplayName, producerSearchOrFilter } from './advisor-search';

describe('advisorSearchOrFilter', () => {
  it('searches name columns that exist on the live table', () => {
    const or = advisorSearchOrFilter('Wen');
    expect(or).toContain('advisor_name.ilike.%Wen%');
    expect(or).toContain('agency_name.ilike.%Wen%');
    expect(or).not.toContain('email');
    expect(or).not.toContain('producer_code');
  });

  it('escapes PostgREST wildcards', () => {
    expect(advisorSearchOrFilter('a%b')).toContain('a\\%b');
  });
});

describe('producerSearchOrFilter (public.advisors — the Enrolled-by source, D5)', () => {
  it('ORs over the live name columns only', () => {
    const or = producerSearchOrFilter('Wen');
    expect(PRODUCER_SEARCH_COLUMNS).toEqual(['full_name', 'first_name', 'last_name', 'agency_name']);
    expect(or).toBe('full_name.ilike.%Wen%,first_name.ilike.%Wen%,last_name.ilike.%Wen%,agency_name.ilike.%Wen%');
    expect(or).not.toContain('email');
    expect(or).not.toContain('phone');
  });

  it('escapes PostgREST wildcards and the filter separators', () => {
    const or = producerSearchOrFilter('a%b,c(d)');
    expect(or).toContain('a\\%b\\,c\\(d\\)');
  });
});

describe('producerDisplayName', () => {
  it('prefers full_name, then "first last", never undefined', () => {
    expect(producerDisplayName({ full_name: ' Wen Producer ', first_name: 'X', last_name: 'Y' })).toBe('Wen Producer');
    expect(producerDisplayName({ full_name: null, first_name: 'Wen', last_name: 'Producer' })).toBe('Wen Producer');
    expect(producerDisplayName({ full_name: '', first_name: null, last_name: 'Producer' })).toBe('Producer');
    expect(producerDisplayName({})).toBe('');
  });
});
