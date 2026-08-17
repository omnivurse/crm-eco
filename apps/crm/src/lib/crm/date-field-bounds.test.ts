import { describe, expect, it } from 'vitest';
import {
  dateValueToInputDisplay,
  dateValueToTypedEntryDraft,
  isoDateToTypedEntryDisplay,
  maskDateTyping,
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

describe('dateValueToInputDisplay (controlled date input)', () => {
  it('renders stored ISO as MM/DD/YYYY', () => {
    expect(dateValueToInputDisplay('2026-09-01')).toBe('09/01/2026');
    expect(dateValueToInputDisplay('1985-06-15T00:00:00Z')).toBe('06/15/1985');
  });

  it('never rewrites a value that is still being typed (the 2026→2020 bug)', () => {
    expect(dateValueToInputDisplay('09/01/20')).toBe('09/01/20');
    expect(dateValueToInputDisplay('09/01/202')).toBe('09/01/202');
    expect(dateValueToInputDisplay('09/01/2026')).toBe('09/01/2026');
    expect(dateValueToInputDisplay('9/1/26')).toBe('9/1/26');
  });

  it('is empty for null/undefined', () => {
    expect(dateValueToInputDisplay(null)).toBe('');
    expect(dateValueToInputDisplay(undefined)).toBe('');
  });
});

describe('maskDateTyping (blur mask)', () => {
  it('zero-pads unpadded pasted dates instead of scrambling them', () => {
    expect(maskDateTyping('9/1/2026')).toBe('09/01/2026');
    expect(maskDateTyping('12/1/2026')).toBe('12/01/2026');
    expect(maskDateTyping('1/15/1980')).toBe('01/15/1980');
    expect(maskDateTyping('9/1/26')).toBe('09/01/2026');
    expect(maskDateTyping('9-1-2026')).toBe('09/01/2026');
  });

  it('keeps already-masked and ISO values stable', () => {
    expect(maskDateTyping('09/01/2026')).toBe('09/01/2026');
    expect(maskDateTyping('2026-09-01')).toBe('09/01/2026');
  });

  it('still masks digit-by-digit typing', () => {
    expect(maskDateTyping('0901')).toBe('09/01');
    expect(maskDateTyping('09012026')).toBe('09/01/2026');
    expect(maskDateTyping('')).toBe('');
  });
});
