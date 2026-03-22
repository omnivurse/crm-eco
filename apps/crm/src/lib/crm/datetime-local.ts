/**
 * Values from Postgres / JSON often arrive as ISO-8601 with `Z` or a timezone offset.
 * `<input type="datetime-local">` only accepts `yyyy-MM-ddThh:mm` (optional seconds / ms), never `Z`.
 */

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

/** Format a Date in the user's local timezone for datetime-local inputs. */
export function formatDateForDatetimeLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * Convert an ISO / DB timestamp string (or Date) to a value safe for datetime-local inputs.
 */
export function toDatetimeLocalValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : formatDateForDatetimeLocal(value);
  }
  const raw = String(value).trim();
  if (!raw) return '';

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return formatDateForDatetimeLocal(parsed);
  }

  // Fallback: strip Z / fractional seconds / offset (invalid date strings)
  return raw
    .replace(/\.(\d{3})\d*Z?$/i, '')
    .replace(/Z$/i, '')
    .replace(/[+-]\d{2}:\d{2}$/, '')
    .replace(/[+-]\d{4}$/, '')
    .slice(0, 16);
}
