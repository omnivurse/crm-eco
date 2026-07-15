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
