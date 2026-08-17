/**
 * Phone display normalisation for CRM record forms.
 *
 * Prod (PIFH, 2026-08-17, crm_records.phone, non-deleted):
 *   3035551212        7,801   raw 10 digits (Zoho/import artefact)
 *   303-555-1212      5,549   ← canonical DISPLAY format chosen here
 *   (303) 555-1212    1,761
 *   303 555 1212        189
 *   303.555.1212         49
 *   +1…                   7
 *   other               341   (extensions, foreign, free text)
 *
 * The dashed form is the dominant *formatted* style already in the data and
 * is what reps read/quote back, so new/edited phones are normalised to it on
 * blur. Matching (duplicate check, search, member↔record resolution) is always
 * digits-based, so the display format never affects lookups.
 *
 * Contract — never destroys what the user typed:
 *   - Only a clean US number (10 digits, or 11 digits with a leading `1`)
 *     is reformatted. Anything else (extensions, international, partial
 *     entry) is returned untouched so the value round-trips verbatim.
 *   - Stored values are NOT rewritten on read; callers apply this on blur
 *     and only when the value actually changed (see FormFieldRenderer).
 */

/** Strip non-digits so `940-735-9792` and `9407359792` compare equal. */
export function phoneDigits(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}

/**
 * Format a phone for display as `NNN-NNN-NNNN` when it is an unambiguous US
 * number; otherwise return the trimmed input unchanged.
 */
export function formatPhoneDisplay(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const trimmed = String(value).trim();
  if (trimmed === '') return '';
  // Only reformat values that are purely phone punctuation + digits; leave
  // free text ("call after 5", "x204") alone so nothing is destroyed.
  if (!/^[\d\s\-+().]+$/.test(trimmed)) return trimmed;
  let digits = phoneDigits(trimmed);
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  if (digits.length !== 10) return trimmed;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * Comparable key for duplicate detection: last 10 digits (drops a US country
 * code) — mirrors the SQL in `check_crm_duplicate`.
 */
export function phoneMatchKey(value: string | null | undefined): string {
  const digits = phoneDigits(value);
  return digits.length > 10 ? digits.slice(-10) : digits;
}
