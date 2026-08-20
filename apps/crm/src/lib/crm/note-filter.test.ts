import { describe, expect, it } from 'vitest';
import {
  countNotesByOrigin,
  defaultNoteOriginFilter,
  filterNotesByOrigin,
  isLegacyNote,
  noteOriginFilterOptions,
  originFilterHidesCurrent,
} from './note-filter';

const current = { id: 'a', created_by: 'user-1' };
const legacy1 = { id: 'b', created_by: null };
const legacy2 = { id: 'c', created_by: '' };
const notes = [current, legacy1, legacy2];

describe('isLegacyNote', () => {
  it('treats null or empty created_by as legacy', () => {
    expect(isLegacyNote(legacy1)).toBe(true);
    expect(isLegacyNote(legacy2)).toBe(true);
    expect(isLegacyNote(current)).toBe(false);
  });
});

describe('countNotesByOrigin', () => {
  it('counts current, legacy and all', () => {
    expect(countNotesByOrigin(notes)).toEqual({ current: 1, legacy: 2, all: 3 });
  });
  it('handles an empty list', () => {
    expect(countNotesByOrigin([])).toEqual({ current: 0, legacy: 0, all: 0 });
  });
});

describe('filterNotesByOrigin', () => {
  it('filters to current notes', () => {
    expect(filterNotesByOrigin(notes, 'current').map((n) => n.id)).toEqual(['a']);
  });
  it('filters to legacy notes', () => {
    expect(filterNotesByOrigin(notes, 'legacy').map((n) => n.id)).toEqual(['b', 'c']);
  });
  it('returns a new array preserving order for all', () => {
    const all = filterNotesByOrigin(notes, 'all');
    expect(all).toEqual(notes);
    expect(all).not.toBe(notes);
  });
});

describe('defaultNoteOriginFilter', () => {
  it('always defaults to All so current notes cannot hide behind Imported', () => {
    expect(defaultNoteOriginFilter({ current: 1, legacy: 500, all: 501 })).toBe('all');
    expect(defaultNoteOriginFilter({ current: 0, legacy: 3, all: 3 })).toBe('all');
    expect(defaultNoteOriginFilter({ current: 0, legacy: 0, all: 0 })).toBe('all');
  });
});

describe('originFilterHidesCurrent', () => {
  it('is true only when Imported is selected and CRM notes exist', () => {
    const mixed = { current: 2, legacy: 37, all: 39 };
    expect(originFilterHidesCurrent('legacy', mixed)).toBe(true);
    expect(originFilterHidesCurrent('all', mixed)).toBe(false);
    expect(originFilterHidesCurrent('current', mixed)).toBe(false);
    expect(originFilterHidesCurrent('legacy', { current: 0, legacy: 3, all: 3 })).toBe(false);
  });
});

describe('noteOriginFilterOptions', () => {
  it('returns All | This CRM | Imported with counts (All first = default)', () => {
    expect(noteOriginFilterOptions({ current: 2, legacy: 5, all: 7 })).toEqual([
      { id: 'all', label: 'All', count: 7 },
      { id: 'current', label: 'This CRM', count: 2 },
      { id: 'legacy', label: 'Imported', count: 5 },
    ]);
  });
});
