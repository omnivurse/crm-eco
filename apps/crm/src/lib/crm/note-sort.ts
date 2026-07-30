import type { CrmNote } from './types';
import { noteSortTime } from './note-timestamp';

export type NoteSortDirection = 'newest' | 'oldest';

/** The only fields ordering depends on, so any note-shaped record can be sorted. */
type SortableNote = Pick<CrmNote, 'is_pinned' | 'note_date' | 'created_at'>;

/**
 * Single source of truth for how a record's notes are ordered.
 *
 * Pinned notes always lead (in both directions), then notes order by their
 * effective date from `noteSortTime`, with `created_at` as a stable tiebreaker
 * so equal dates never shuffle between renders. Returns a new array.
 *
 * Both the Notes tab and the record overview card call this. Keeping one
 * implementation is deliberate: duplicated comparators previously drifted and
 * reintroduced note misordering.
 */
export function sortNotesForDisplay<T extends SortableNote>(
  notes: readonly T[],
  direction: NoteSortDirection = 'newest',
): T[] {
  const dirMul = direction === 'newest' ? 1 : -1;
  return [...notes].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    const diff = noteSortTime(b.note_date, b.created_at) - noteSortTime(a.note_date, a.created_at);
    if (diff !== 0) return diff * dirMul;
    return (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) * dirMul;
  });
}
