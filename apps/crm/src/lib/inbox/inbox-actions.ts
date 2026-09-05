/**
 * Pure helpers behind the inbox command surfaces (ribbon, row hover, bulk bar).
 *
 * Kept out of the components so the parts that are easy to get subtly wrong —
 * when "tomorrow morning" actually is, whether a flag toggle drops the thread's
 * other tags, whether a snoozed thread ever comes back — are unit-tested rather
 * than eyeballed.
 */

import { FLAG_TAG } from './inbox-view-model';

export interface SnoozePreset {
  key: string;
  label: string;
  /** Absolute wake time. `now` is injectable so the maths can be tested. */
  resolve: (now?: Date) => Date;
}

const HOUR_MS = 60 * 60 * 1000;

function atHour(from: Date, hour: number, addDays = 0): Date {
  const next = new Date(from);
  next.setDate(next.getDate() + addDays);
  next.setHours(hour, 0, 0, 0);
  return next;
}

/**
 * Outlook's snooze menu.
 *
 * Each preset must land in the future or it would wake the thread instantly,
 * so "later today" rolls forward to tomorrow morning once the working day is
 * over, and "this weekend"/"next week" skip to the following week when today
 * is already past them.
 */
export const SNOOZE_PRESETS: SnoozePreset[] = [
  {
    key: 'later_today',
    label: 'Later today',
    resolve: (now = new Date()) => {
      const candidate = atHour(now, 16);
      return candidate.getTime() - now.getTime() > HOUR_MS ? candidate : atHour(now, 8, 1);
    },
  },
  {
    key: 'tomorrow',
    label: 'Tomorrow morning',
    resolve: (now = new Date()) => atHour(now, 8, 1),
  },
  {
    key: 'this_weekend',
    label: 'This weekend',
    resolve: (now = new Date()) => {
      // Saturday is day 6; when it is already Saturday or Sunday, mean next one.
      const daysUntilSaturday = (6 - now.getDay() + 7) % 7 || 7;
      return atHour(now, 8, daysUntilSaturday);
    },
  },
  {
    key: 'next_week',
    label: 'Next week',
    resolve: (now = new Date()) => {
      // Monday is day 1.
      const daysUntilMonday = (1 - now.getDay() + 7) % 7 || 7;
      return atHour(now, 8, daysUntilMonday);
    },
  },
];

/** Add or remove the flag without disturbing the thread's other tags. */
export function toggleFlagTags(tags: readonly string[] | null | undefined, flagged: boolean): string[] {
  const current = tags ?? [];
  if (flagged) return current.filter((tag) => tag !== FLAG_TAG);
  return current.includes(FLAG_TAG) ? [...current] : [...current, FLAG_TAG];
}

/**
 * Has a snoozed thread's timer run out?
 *
 * Nothing in the system wakes a snoozed thread — there is no cron for it — so
 * without this the Snooze button is a way to lose an email permanently. The
 * list treats an expired snooze as Incoming, and opening the thread clears the
 * status for real.
 */
export function isSnoozeExpired(
  conversation: { status?: string | null; snoozed_until?: string | null },
  now: Date = new Date(),
): boolean {
  if (conversation.status !== 'snoozed') return false;
  if (!conversation.snoozed_until) return true;
  const wake = new Date(conversation.snoozed_until).getTime();
  if (!Number.isFinite(wake)) return true;
  return wake <= now.getTime();
}

/** A thread the Incoming folder should show, snooze expiry included. */
export function belongsInIncoming(
  conversation: { status?: string | null; snoozed_until?: string | null },
  now: Date = new Date(),
): boolean {
  if (conversation.status === 'open' || conversation.status === 'pending') return true;
  return isSnoozeExpired(conversation, now);
}

export interface StatusSnapshot<S extends string = string> {
  id: string;
  status: S;
}

/**
 * What a bulk action must remember to be undoable.
 *
 * A bulk move writes one status to many rows; putting them back means
 * restoring each row's own prior status, not a single blanket value.
 */
export function captureStatuses<S extends string>(
  conversations: ReadonlyArray<{ id: string; status: S }>,
  ids: Iterable<string>,
): Array<StatusSnapshot<S>> {
  const wanted = new Set(ids);
  return conversations
    .filter((conversation) => wanted.has(conversation.id))
    .map((conversation) => ({ id: conversation.id, status: conversation.status }));
}

/** Group an undo snapshot into one update per distinct prior status. */
export function groupByStatus<S extends string>(
  snapshots: ReadonlyArray<StatusSnapshot<S>>,
): Array<{ status: S; ids: string[] }> {
  const groups = new Map<S, string[]>();
  for (const snapshot of snapshots) {
    const bucket = groups.get(snapshot.status);
    if (bucket) bucket.push(snapshot.id);
    else groups.set(snapshot.status, [snapshot.id]);
  }
  return [...groups.entries()].map(([status, ids]) => ({ status, ids }));
}
