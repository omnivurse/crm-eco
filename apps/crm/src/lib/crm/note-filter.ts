/**
 * Current-vs-legacy note filtering for the record Notes tab.
 *
 * `crm_notes` mixes two populations: notes written in this CRM (`created_by`
 * points at a profile) and rows bulk-imported from the legacy Zoho export
 * (`created_by IS NULL` — there is no dedicated `source` column).
 *
 * Default is always **All** (newest first). Filtering to Imported used to hide
 * notes a rep wrote yesterday — they opened the 2025 history and thought the
 * new work had disappeared.
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
 * Initial filter: always All so a new CRM note cannot hide behind Imported.
 * `counts` is accepted so call sites stay stable; it does not change the default.
 */
export function defaultNoteOriginFilter(_counts?: NoteOriginCounts): NoteOriginFilter {
  return 'all';
}

/** True when the Imported chip is hiding notes written in this CRM. */
export function originFilterHidesCurrent(
  filter: NoteOriginFilter,
  counts: NoteOriginCounts,
): boolean {
  return filter === 'legacy' && counts.current > 0;
}

/** Filter chips in display order with their labels and counts. */
export function noteOriginFilterOptions(
  counts: NoteOriginCounts,
): Array<{ id: NoteOriginFilter; label: string; count: number }> {
  return [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'current', label: 'This CRM', count: counts.current },
    { id: 'legacy', label: 'Imported', count: counts.legacy },
  ];
}
