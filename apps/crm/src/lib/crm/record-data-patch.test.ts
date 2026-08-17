import { describe, it, expect } from 'vitest';
import {
  buildRecordDataPatch,
  formValuesEqual,
  isBlankFormValue,
  isEmptyRecordDataPatch,
} from './record-data-patch';

describe('isBlankFormValue', () => {
  it('treats undefined / null / empty / whitespace strings as blank', () => {
    expect(isBlankFormValue(undefined)).toBe(true);
    expect(isBlankFormValue(null)).toBe(true);
    expect(isBlankFormValue('')).toBe(true);
    expect(isBlankFormValue('   ')).toBe(true);
  });
  it('does not treat 0 / false / [] / {} as blank', () => {
    expect(isBlankFormValue(0)).toBe(false);
    expect(isBlankFormValue(false)).toBe(false);
    expect(isBlankFormValue([])).toBe(false);
    expect(isBlankFormValue({})).toBe(false);
  });
});

describe('formValuesEqual', () => {
  it('blank values are equivalent to each other', () => {
    expect(formValuesEqual(undefined, null)).toBe(true);
    expect(formValuesEqual('', null)).toBe(true);
    expect(formValuesEqual('', undefined)).toBe(true);
  });
  it('blank vs non-blank differs', () => {
    expect(formValuesEqual('', 'a')).toBe(false);
    expect(formValuesEqual(null, 0)).toBe(false);
    expect(formValuesEqual(undefined, false)).toBe(false);
  });
  it('compares arrays deeply and order-sensitively', () => {
    expect(formValuesEqual(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(formValuesEqual(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(formValuesEqual(['a'], ['a', 'b'])).toBe(false);
    expect(formValuesEqual([{ x: 1 }], [{ x: 1 }])).toBe(true);
  });
  it('compares plain objects deeply regardless of key order', () => {
    expect(formValuesEqual({ a: 1, b: { c: [1, 2] } }, { b: { c: [1, 2] }, a: 1 })).toBe(true);
    expect(formValuesEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(formValuesEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    // Blank-equivalence applies inside nested values too.
    expect(formValuesEqual({ a: '' }, { a: null })).toBe(true);
    expect(formValuesEqual({ a: '' }, {})).toBe(true);
  });
  it('compares Dates by time', () => {
    expect(formValuesEqual(new Date('2026-01-01'), new Date('2026-01-01'))).toBe(true);
    expect(formValuesEqual(new Date('2026-01-01'), new Date('2026-01-02'))).toBe(false);
  });
  it('is strict about type differences', () => {
    expect(formValuesEqual('1', 1)).toBe(false);
    expect(formValuesEqual([], {})).toBe(false);
    expect(formValuesEqual(true, 'true')).toBe(false);
  });
});

describe('buildRecordDataPatch', () => {
  const initial = {
    first_name: 'Ada',
    last_name: 'Lovelace',
    email: 'ada@example.com',
    phone: '',
    date_of_birth: null,
    tags: ['vip', 'ny'],
    address: { street: '1 Main', city: 'NYC' },
    // Projected / overlaid values that the form shows but the rep never touched.
    sharing_status: 'Active HS Member',
    legacy_dob: '01/00/2000',
  };

  it('returns an empty patch when nothing changed (same object)', () => {
    const patch = buildRecordDataPatch(initial, { ...initial });
    expect(patch).toEqual({});
    expect(isEmptyRecordDataPatch(patch)).toBe(true);
  });

  it('includes only changed keys', () => {
    const patch = buildRecordDataPatch(initial, { ...initial, first_name: 'Grace' });
    expect(patch).toEqual({ first_name: 'Grace' });
  });

  it('does not send untouched projected / overlaid values', () => {
    const patch = buildRecordDataPatch(initial, { ...initial, last_name: 'Byron' });
    expect(patch).not.toHaveProperty('sharing_status');
    expect(patch).not.toHaveProperty('legacy_dob');
    expect(patch).toEqual({ last_name: 'Byron' });
  });

  it('emits intentional clears as null', () => {
    expect(buildRecordDataPatch(initial, { ...initial, email: '' })).toEqual({ email: null });
    expect(buildRecordDataPatch(initial, { ...initial, email: null })).toEqual({ email: null });
    expect(buildRecordDataPatch(initial, { ...initial, email: undefined })).toEqual({ email: null });
  });

  it('treats blank → blank transitions as unchanged', () => {
    const patch = buildRecordDataPatch(initial, {
      ...initial,
      phone: null,
      date_of_birth: '',
    });
    expect(patch).toEqual({});
  });

  it('includes newly added keys', () => {
    const patch = buildRecordDataPatch(initial, { ...initial, company: 'Analytical Engines' });
    expect(patch).toEqual({ company: 'Analytical Engines' });
    // Filling a previously blank key counts as added, not a clear.
    expect(buildRecordDataPatch(initial, { ...initial, phone: '555-0100' })).toEqual({
      phone: '555-0100',
    });
  });

  it('does not treat keys missing from the current form as clears', () => {
    const { legacy_dob: _omit, ...withoutLegacy } = initial;
    void _omit;
    const patch = buildRecordDataPatch(initial, withoutLegacy);
    expect(patch).toEqual({});
  });

  it('handles array fields (unchanged / reordered / cleared)', () => {
    expect(buildRecordDataPatch(initial, { ...initial, tags: ['vip', 'ny'] })).toEqual({});
    expect(buildRecordDataPatch(initial, { ...initial, tags: ['ny', 'vip'] })).toEqual({
      tags: ['ny', 'vip'],
    });
    expect(buildRecordDataPatch(initial, { ...initial, tags: ['vip'] })).toEqual({
      tags: ['vip'],
    });
    // Emptying an array is a real change and is sent as the empty array
    // (arrays are not "blank"), never silently dropped.
    expect(buildRecordDataPatch(initial, { ...initial, tags: [] })).toEqual({ tags: [] });
  });

  it('handles nested object fields', () => {
    expect(
      buildRecordDataPatch(initial, { ...initial, address: { city: 'NYC', street: '1 Main' } }),
    ).toEqual({});
    expect(
      buildRecordDataPatch(initial, { ...initial, address: { street: '2 Main', city: 'NYC' } }),
    ).toEqual({ address: { street: '2 Main', city: 'NYC' } });
  });

  it('honors alwaysInclude when the key is present in the form', () => {
    const patch = buildRecordDataPatch(
      initial,
      { ...initial, first_name: 'Grace' },
      { alwaysInclude: ['contact_status', 'email'] },
    );
    // contact_status is not in the form → not included; email is → included even though unchanged.
    expect(patch).toEqual({ first_name: 'Grace', email: 'ada@example.com' });
  });

  it('tolerates null / undefined inputs', () => {
    expect(buildRecordDataPatch(null, undefined)).toEqual({});
    expect(buildRecordDataPatch(undefined, { a: 1 })).toEqual({ a: 1 });
    expect(buildRecordDataPatch({ a: 1 }, null)).toEqual({});
  });
});
