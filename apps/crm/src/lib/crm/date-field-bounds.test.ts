import { describe, expect, it } from 'vitest';
import {
  dateValueToTypedEntryDraft,
  isoDateToTypedEntryDisplay,
} from './date-field-bounds';

describe('date-field-bounds helpers', () => {
  it('formats ISO dates for typed entry', () => {
    expect(isoDateToTypedEntryDisplay('1965-03-15')).toBe('3/15/1965');
    expect(isoDateToTypedEntryDisplay('1920-01-01')).toBe('1/1/1920');
  });

  it('builds edit drafts from stored values', () => {
    expect(dateValueToTypedEntryDraft('1965-03-15')).toBe('3/15/1965');
    expect(dateValueToTypedEntryDraft('3/15/1965')).toBe('3/15/1965');
    expect(dateValueToTypedEntryDraft(null)).toBe('');
  });
});
