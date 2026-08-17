import { describe, expect, it } from 'vitest';
import {
  FULL_ROW_SPAN_CLASS,
  INLINE_EDIT_GRID_CLASS,
  fieldSpansFullRow,
  shouldUseDenseFieldRow,
} from './field-layout';

describe('shouldUseDenseFieldRow', () => {
  it('uses dense rows only for static read-only overview cells', () => {
    expect(
      shouldUseDenseFieldRow({ row: true, readOnly: true, inlineEditable: false }),
    ).toBe(true);
  });

  it('forces stacked cells when inlineEditable (leads/contacts/members)', () => {
    expect(
      shouldUseDenseFieldRow({ row: true, readOnly: true, inlineEditable: true }),
    ).toBe(false);
  });

  it('never densifies edit forms', () => {
    expect(
      shouldUseDenseFieldRow({ row: true, readOnly: false, inlineEditable: false }),
    ).toBe(false);
  });

  it('ignores densify when row flag is off', () => {
    expect(
      shouldUseDenseFieldRow({ row: false, readOnly: true, inlineEditable: false }),
    ).toBe(false);
  });
});

describe('INLINE_EDIT_GRID_CLASS', () => {
  it('starts at two columns and packs denser on wide screens (data at a glance)', () => {
    expect(INLINE_EDIT_GRID_CLASS).toContain('sm:grid-cols-2');
    expect(INLINE_EDIT_GRID_CLASS).toContain('xl:grid-cols-3');
    expect(INLINE_EDIT_GRID_CLASS).toContain('2xl:grid-cols-4');
    // Never 3 columns at md — stacked editors need ~16rem each.
    expect(INLINE_EDIT_GRID_CLASS).not.toContain('md:grid-cols-3');
  });
});

describe('fieldSpansFullRow', () => {
  it('ignores the mass-imported width="full" on scalar fields', () => {
    for (const type of ['text', 'select', 'date', 'currency', 'boolean', 'email', 'phone', 'number', 'lookup']) {
      expect(fieldSpansFullRow({ type, width: 'full' })).toBe(false);
    }
  });

  it('gives genuinely long fields a whole row', () => {
    expect(fieldSpansFullRow({ type: 'textarea', width: 'half' })).toBe(true);
    expect(fieldSpansFullRow({ type: 'multiselect', width: 'full' })).toBe(true);
  });

  it('spans every column of whichever grid it lands in', () => {
    expect(FULL_ROW_SPAN_CLASS).toBe('md:col-span-full');
  });
});
