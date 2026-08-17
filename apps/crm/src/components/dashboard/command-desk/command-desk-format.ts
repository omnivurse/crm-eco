/**
 * Pure formatting helpers for the dashboard command desk.
 *
 * No React, no DOM, no server imports — safe from both server and client
 * components and unit-tested in command-desk-format.test.ts.
 */

export const NOT_ON_FILE = 'Not on file';

const DAY_MS = 86_400_000;

/**
 * Parse an ISO date-only string ("2026-09-01") as a LOCAL calendar date so a
 * coverage start of Sep 1 never renders as Aug 31 west of UTC. Full ISO
 * timestamps are parsed as-is. Returns null for empty / invalid input.
 */
export function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnly) {
    const d = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Whole calendar days from `now` to `value` (negative = past). */
export function calendarDaysFrom(value: string | null | undefined, now: Date = new Date()): number | null {
  const d = parseIsoDate(value);
  if (!d) return null;
  return Math.round((startOfLocalDay(d) - startOfLocalDay(now)) / DAY_MS);
}

/**
 * Compact relative label: "today", "3d ago", "in 5d", "2w ago", "in 3mo".
 * Falls back to `fallback` (default: empty string) when the date is missing.
 */
export function formatRelativeDays(
  value: string | null | undefined,
  now: Date = new Date(),
  fallback = '',
): string {
  const days = calendarDaysFrom(value, now);
  if (days === null) return fallback;
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  const abs = Math.abs(days);
  let unit: string;
  if (abs < 14) unit = `${abs}d`;
  else if (abs < 60) unit = `${Math.round(abs / 7)}w`;
  else if (abs < 365) unit = `${Math.round(abs / 30)}mo`;
  else unit = `${Math.round(abs / 365)}y`;
  return days < 0 ? `${unit} ago` : `in ${unit}`;
}

/** "Sep 1" for the current year, "Sep 1, 2025" for other years. */
export function formatShortDate(
  value: string | null | undefined,
  now: Date = new Date(),
  fallback = NOT_ON_FILE,
): string {
  const d = parseIsoDate(value);
  if (!d) return fallback;
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** "Mar 4, 1962" — always includes the year (DOB, member since). */
export function formatDateWithYear(value: string | null | undefined, fallback = NOT_ON_FILE): string {
  const d = parseIsoDate(value);
  if (!d) return fallback;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Trimmed string or the "Not on file" fallback. */
export function orNotOnFile(value: string | null | undefined): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed || NOT_ON_FILE;
}

/** True when a value is present (used to decide muted-italic styling). */
export function hasValue(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Initials fallback when the queue item has none: first + last word, upper
 * case, "?" when nothing usable.
 */
export function initialsFor(name: string | null | undefined, provided?: string | null): string {
  if (provided && provided.trim()) return provided.trim().slice(0, 2).toUpperCase();
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  const out = (first + last).toUpperCase();
  return out || '?';
}

/** `tel:` href from a free-form phone; null when nothing dialable. */
export function telHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, '');
  const bare = digits.replace(/\+/g, '');
  if (bare.length < 7) return null;
  return `tel:${digits.startsWith('+') ? '+' : ''}${bare}`;
}

/** `mailto:` href from an email; null when it does not look like one. */
export function mailtoHref(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return `mailto:${trimmed}`;
}

/** "City, ST" · "City" · "ST" · null */
export function formatCityState(city: string | null | undefined, state: string | null | undefined): string | null {
  const c = city?.trim() ?? '';
  const s = state?.trim() ?? '';
  if (c && s) return `${c}, ${s}`;
  return c || s || null;
}

/**
 * Record page deep link. `pane` maps to RecordDetailShellV2's `?pane=` reader
 * (notes | emails | attachments | related | timeline).
 */
export function recordHref(
  recordId: string,
  opts?: { pane?: 'notes' | 'emails' | 'attachments' | 'related' | 'timeline' },
): string {
  const base = `/crm/r/${recordId}`;
  return opts?.pane ? `${base}?pane=${opts.pane}` : base;
}

/** Contacts list pre-filtered to Pending members (ModulePage `filters` JSON). */
export function pendingContactsHref(): string {
  const filters = JSON.stringify([
    { field: 'contact_status', operator: 'equals', value: 'Pending' },
  ]);
  return `/crm/modules/contacts?filters=${encodeURIComponent(filters)}`;
}

export type StatusTone = 'active' | 'pending' | 'prospect' | 'inactive' | 'lost' | 'neutral';

/** Coarse tone bucket for arbitrary CRM status strings ("Active HS Member", "Pending", …). */
export function statusTone(status: string | null | undefined): StatusTone {
  const s = (status ?? '').toLowerCase();
  if (!s) return 'neutral';
  if (/pending|awaiting|hold/.test(s)) return 'pending';
  if (/cancel|lost|terminated|declined|closed lost/.test(s)) return 'lost';
  if (/in-?active|dormant|expired/.test(s)) return 'inactive';
  if (/active|converted|won|enrolled|member/.test(s)) return 'active';
  if (/prospect|new|contacted|qualified|working|lead/.test(s)) return 'prospect';
  return 'neutral';
}

/** Pluralize with count: "1 person", "12 people". */
export function countLabel(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}
