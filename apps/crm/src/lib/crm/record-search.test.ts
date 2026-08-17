import { describe, expect, it } from 'vitest';
import {
  IDENTIFIER_SEARCH_JSON_KEYS,
  buildIdentifierSearchOrFilter,
  isNumericIdentifierQuery,
  mergeUniqueByIdPreserveOrder,
} from './record-search';

describe('isNumericIdentifierQuery', () => {
  it('is true for a bare run of ≥4 digits (member numbers are 7–9 digits in PIFH)', () => {
    expect(isNumericIdentifierQuery('1234567')).toBe(true);
    expect(isNumericIdentifierQuery(' 123456789 ')).toBe(true);
    expect(isNumericIdentifierQuery('3035551212')).toBe(true);
    expect(isNumericIdentifierQuery('1234')).toBe(true);
  });

  it('is false for formatted phones, short fragments and text', () => {
    expect(isNumericIdentifierQuery('303-555-1212')).toBe(false);
    expect(isNumericIdentifierQuery('(303) 555 1212')).toBe(false);
    expect(isNumericIdentifierQuery('123')).toBe(false);
    expect(isNumericIdentifierQuery('Jane 5551212')).toBe(false);
    expect(isNumericIdentifierQuery('')).toBe(false);
    expect(isNumericIdentifierQuery('1'.repeat(21))).toBe(false);
  });
});

describe('buildIdentifierSearchOrFilter', () => {
  it('targets the member-id JSONB keys with an escaped substring pattern', () => {
    expect(buildIdentifierSearchOrFilter('1234567')).toBe(
      'data->>member_number.ilike.%1234567%,data->>sharing_member_id.ilike.%1234567%,data->>e123_member_id.ilike.%1234567%',
    );
    expect(IDENTIFIER_SEARCH_JSON_KEYS).toEqual(['member_number', 'sharing_member_id', 'e123_member_id']);
  });

  it('escapes ilike wildcards and skips unsafe keys', () => {
    expect(buildIdentifierSearchOrFilter('12%34', ['member_number'])).toBe(
      'data->>member_number.ilike.%12\\%34%',
    );
    expect(buildIdentifierSearchOrFilter('123', ['ok_key', 'bad-key', 'data::text'])).toBe(
      'data->>ok_key.ilike.%123%',
    );
  });

  it('returns an empty string for a blank query so the caller skips the pass', () => {
    expect(buildIdentifierSearchOrFilter('   ')).toBe('');
  });
});

describe('mergeUniqueByIdPreserveOrder', () => {
  const row = (id: string) => ({ id });

  it('keeps primary (phone) hits first, appends new secondary (identifier) hits, dedupes', () => {
    const merged = mergeUniqueByIdPreserveOrder(
      [row('p1'), row('p2'), row('p1')],
      [row('p2'), row('i1'), row('i2')],
      10,
    );
    expect(merged.map((r) => r.id)).toEqual(['p1', 'p2', 'i1', 'i2']);
  });

  it('honours the limit across both lists', () => {
    expect(
      mergeUniqueByIdPreserveOrder([row('a'), row('b')], [row('c'), row('d')], 3).map((r) => r.id),
    ).toEqual(['a', 'b', 'c']);
    expect(mergeUniqueByIdPreserveOrder([row('a'), row('b')], [row('c')], 1).map((r) => r.id)).toEqual(['a']);
  });

  it('works when the phone path returns nothing (member number only)', () => {
    expect(mergeUniqueByIdPreserveOrder([], [row('i1')], 5).map((r) => r.id)).toEqual(['i1']);
  });
});
