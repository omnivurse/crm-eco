/**
 * Current-vs-legacy note filtering for the record Notes tab.
 *
 * `crm_notes` mixes two populations: notes written in this CRM (`created_by`
 * points at a profile) and rows bulk-imported from the legacy Zoho export
 * (`created_by IS NULL` — there is no dedicated `source` column). Users care
 * about the current notes day-to-day, so the panel filters to those by
 * default and keeps the imported history one click away.
 */

export type NoteOriginFilter = 'current' | 'legacy' | 'all';

/** The only field origin depends on, so any note-shaped record can be filtered. */
export type OriginFilterableNote = { created_by: string | null };

export interface NoteOriginCounts {
  current: number;
  legacy: number;
  all: number;
}

/** A note is "legacy" when it was imported without a CRM author (`created_by` null/empty). */
export function isLegacyNote(note: OriginFilterableNote): boolean {
  return !note.created_by;
}

export function countNotesByOrigin(notes: readonly OriginFilterableNote[]): NoteOriginCounts {
  let legacy = 0;
  for (const n of notes) if (isLegacyNote(n)) legacy += 1;
  return { current: notes.length - legacy, legacy, all: notes.length };
}

/** Returns a new array containing only the notes matching `filter`. */
export function filterNotesByOrigin<T extends OriginFilterableNote>(
  notes: readonly T[],
  filter: NoteOriginFilter,
): T[] {
  if (filter === 'all') return [...notes];
  const wantLegacy = filter === 'legacy';
  return notes.filter((n) => isLegacyNote(n) === wantLegacy);
}

/**
 * Initial filter for a record: "current" whenever at least one current note
 * exists, otherwise "all" so a legacy-only record never opens on an empty list.
 */
export function defaultNoteOriginFilter(counts: NoteOriginCounts): NoteOriginFilter {
  return counts.current > 0 ? 'current' : 'all';
}

/** Filter chips in display order with their labels and counts. */
export function noteOriginFilterOptions(
  counts: NoteOriginCounts,
): Array<{ id: NoteOriginFilter; label: string; count: number }> {
  return [
    { id: 'current', label: 'Current', count: counts.current },
    { id: 'legacy', label: 'Legacy', count: counts.legacy },
    { id: 'all', label: 'All', count: counts.all },
  ];
}
