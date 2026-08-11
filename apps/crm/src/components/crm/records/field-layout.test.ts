import { describe, expect, it } from 'vitest';
import {
  INLINE_EDIT_GRID_CLASS,
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
  it('caps at two columns so stacked editors have room', () => {
    expect(INLINE_EDIT_GRID_CLASS).toContain('sm:grid-cols-2');
    expect(INLINE_EDIT_GRID_CLASS).not.toContain('md:grid-cols-3');
  });
});
