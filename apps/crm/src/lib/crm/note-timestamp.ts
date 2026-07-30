/**
 * Shared note timestamp formatting.
 *
 * Every note is automatically stamped with `created_at` on the server when
 * it is saved — users never need to type the date themselves. These helpers
 * render that stamp as an explicit, easy-to-scan date + time (rather than
 * only a vague "3 days ago") so the date is always visible on note cards.
 */
import { format, formatDistanceToNow, isThisYear } from 'date-fns';

/**
 * Explicit date + time, e.g. "Tue, Jul 15 · 3:52 PM" (year appended when the
 * note is from a previous year: "Tue, Jul 15, 2025 · 3:52 PM").
 */
export function formatNoteTimestamp(dateInput: string | Date): string {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return '';
  const pattern = isThisYear(date) ? 'EEE, MMM d · h:mm a' : 'EEE, MMM d, yyyy · h:mm a';
  return format(date, pattern);
}

/** Relative form ("3 days ago") — used as a hover tooltip alongside the explicit stamp. */
export function formatNoteRelative(dateInput: string | Date): string {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return '';
  return formatDistanceToNow(date, { addSuffix: true });
}

/**
 * True when a note was meaningfully edited after it was created.
 *
 * Both `created_at` and `updated_at` default to `now()` on INSERT, so they are
 * effectively equal for a brand-new note. A small threshold absorbs any
 * sub-second clock jitter between the two stamps and prevents freshly created
 * notes from being mislabelled "Edited"; anything beyond it reflects a real
 * user edit (a PATCH bumps `updated_at`).
 */
export function isNoteEdited(
  createdAt: string | Date,
  updatedAt: string | Date | null | undefined,
): boolean {
  if (!updatedAt) return false;
  const created = new Date(createdAt).getTime();
  const updated = new Date(updatedAt).getTime();
  if (Number.isNaN(created) || Number.isNaN(updated)) return false;
  return updated - created > 2000;
}

/**
 * Local calendar date (YYYY-MM-DD) suitable for an `<input type="date">` value.
 * Defaults to today. Used to seed the "Note date" picker.
 */
export function localDateInputValue(dateInput: string | Date = new Date()): string {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Format a bare YYYY-MM-DD note date as "Jul 24, 2026". */
export function formatNoteDateOnly(noteDate: string): string {
  const d = new Date(`${noteDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return format(d, 'MMM d, yyyy');
}

/** True when a note's explicit date refers to a different day than when it was saved. */
export function noteDateDiffersFromCreated(
  noteDate: string | null | undefined,
  createdAt: string,
): boolean {
  if (!noteDate) return false;
  return noteDate !== localDateInputValue(createdAt);
}

/**
 * Millisecond value a note should sort by: its explicit `note_date` when set,
 * otherwise the system `created_at`. Lets back-dated notes sort by the date the
 * advisor actually means rather than when they happened to type it.
 */
export function noteSortTime(noteDate: string | null | undefined, createdAt: string): number {
  const t = noteDate ? new Date(`${noteDate}T00:00:00`).getTime() : new Date(createdAt).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Decide what to persist for a note's `note_date`. Returns the picked date only
 * when it's a genuine back-date — i.e. it differs from the reference day the
 * note would otherwise sort by (today for a new note, the created day for an
 * existing one). Otherwise returns null so the note keeps falling back to
 * `created_at`.
 *
 * Without this, defaulting the picker to "today" would stamp every note with an
 * explicit date and sort it at local midnight, pushing it out of created_at
 * order relative to notes that have no note_date.
 */
export function backdatedNoteDateOrNull(
  picked: string | null | undefined,
  referenceDay: string,
): string | null {
  if (!picked) return null;
  return picked === referenceDay ? null : picked;
}
