/** Inclusive bounds for CRM DOB / birth-date fields (HTML date inputs + validation). */
export const CRM_DATE_INPUT_MIN = '1900-01-01';
export const CRM_DATE_INPUT_MAX = '2100-12-31';

const COMPLETE_ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True when a native date input value is a complete yyyy-MM-dd string. */
export function isCompleteIsoDateInputValue(value: string): boolean {
  return COMPLETE_ISO_DATE_RE.test(value);
}

/** Format ISO yyyy-MM-dd for typed entry (M/D/YYYY — no leading-zero friction). */
export function isoDateToTypedEntryDisplay(iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return iso;
  return `${Number(match[2])}/${Number(match[3])}/${match[1]}`;
}

/** Seed the text editor from any stored CRM date value. */
export function dateValueToTypedEntryDraft(value: string | null | undefined): string {
  if (!value) return '';
  const iso = value.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
  if (iso) return isoDateToTypedEntryDisplay(iso);
  return value.trim();
}

/** Format ISO yyyy-MM-dd as zero-padded MM/DD/YYYY (round-trips with maskDateTyping). */
export function isoDateToMaskedDisplay(iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return iso;
  return `${match[2]}/${match[3]}/${match[1]}`;
}

/**
 * Mask free-typed date entry toward MM/DD/YYYY as the user types: strips
 * non-digits, caps at 8 digits (MMDDYYYY), and auto-inserts "/" after the month
 * and day. Idempotent on already-masked MM/DD/YYYY input, so editing an existing
 * value does not corrupt it. The result is still parseable by
 * normalizeDateColumnValue (e.g. "02/05/1982" -> 1982-02-05 on save).
 */
export function maskDateTyping(input: string | null | undefined): string {
  const raw = String(input ?? '').trim();
  if (!raw) return '';
  // A complete but UNPADDED slash/dash/dot date ("9/1/2026", "1/15/1980",
  // "9/1/26") must be zero-padded BEFORE digit-chunking — otherwise the digits
  // "912026" re-chunk to "91/20/26" and the value is silently corrupted on blur.
  // Enrollment exports commonly use M/D/YYYY, so this is the client's paste path.
  const slashDate = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/);
  if (slashDate) {
    const [, m, d, y] = slashDate;
    const year = y.length === 2 ? (Number(y) <= 29 ? `20${y}` : `19${y}`) : y;
    return `${m.padStart(2, '0')}/${d.padStart(2, '0')}/${year}`;
  }
  // Stored ISO ("2026-09-01") → display mask, never digit-chunked.
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[2]}/${iso[3]}/${iso[1]}`;
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (!digits) return '';
  const parts = [digits.slice(0, 2)];
  if (digits.length > 2) parts.push(digits.slice(2, 4));
  if (digits.length > 4) parts.push(digits.slice(4, 8));
  return parts.join('/');
}

/**
 * Mask a date input AND compute where the caret should sit afterward, so a
 * controlled input does not scramble digits when the value is re-rendered.
 * `caretOffset` is the caret position in the raw (pre-mask) value; the returned
 * caret lands just after the same number of digits in the masked value.
 */
export function maskDateTypingWithCaret(
  rawValue: string,
  caretOffset: number,
): { value: string; caret: number } {
  const value = maskDateTyping(rawValue);
  const digitsBefore = rawValue.slice(0, Math.max(0, caretOffset)).replace(/\D/g, '').length;
  if (digitsBefore === 0) return { value, caret: 0 };
  let seen = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 48 && code <= 57) seen += 1;
    if (seen >= digitsBefore) return { value, caret: i + 1 };
  }
  return { value, caret: value.length };
}

/** Seed a masked text editor (zero-padded MM/DD/YYYY) from any stored CRM date value. */
export function dateValueToMaskedDraft(value: string | null | undefined): string {
  if (!value) return '';
  const iso = String(value).match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
  if (iso) return isoDateToMaskedDisplay(iso);
  return maskDateTyping(value);
}

/**
 * What a controlled date text input should DISPLAY for the current form value:
 * a stored ISO date renders as zero-padded MM/DD/YYYY; anything else (a value
 * mid-typing such as "09/01/20") is shown exactly as typed. Deliberately does
 * NOT run the storage normaliser: normalizeDateColumnValue treats "09/01/20"
 * as M/D/YY → 2020-09-01, so re-deriving the display on every keystroke
 * rewrote the DOM to "09/01/2020" before the user could finish "2026", and
 * the trailing digits were then truncated on blur → wrong year saved.
 * Masking to MM/DD/YYYY happens on blur (maskDateTyping); ISO on save.
 */
export function dateValueToInputDisplay(value: unknown): string {
  if (value == null) return '';
  const str = typeof value === 'string' ? value : String(value);
  const iso = str.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
  return iso ? isoDateToMaskedDisplay(iso) : str;
}
