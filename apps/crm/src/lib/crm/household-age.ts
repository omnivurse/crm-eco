import { format } from 'date-fns';

/**
 * Household member slots on a contact/lead record. Each slot has a
 * `<slot>_age` (number) and a `<slot>_age_as_of` (YYYY-MM-DD) written by the
 * crm_household_age_as_of trigger whenever the age is entered or changed.
 */
export const HOUSEHOLD_SLOTS = ['spouse', 'child_1', 'child_2', 'child_3', 'child_4', 'child_5'] as const;
export type HouseholdSlot = (typeof HOUSEHOLD_SLOTS)[number];

const AGE_KEY = /^(spouse|child_[1-5])_age$/;

/** The slot a `<slot>_age` key belongs to, or null for any other key. */
export function householdAgeSlot(key: string): HouseholdSlot | null {
  const m = AGE_KEY.exec(key);
  return m ? (m[1] as HouseholdSlot) : null;
}

/** "Yes - 45" / "45" — an age written into a slot's NAME box. */
export const HOUSEHOLD_MARKER_AGE_RE = /^\s*(?:(?:yes|y)\s*[-–:]\s*)?(\d{1,3})\s*$/i;
/** "yes" / "y" — a slot marked present with no detail. */
export const HOUSEHOLD_MARKER_YES_RE = /^\s*(?:yes|y)\s*$/i;
/** "no" / "n" / "none" — a slot explicitly marked absent. */
export const HOUSEHOLD_MARKER_NO_RE = /^\s*(?:no|n|none)\s*$/i;

function isBlank(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

export interface HouseholdCsvRuleOptions {
  /** The file's own Modified Time as YYYY-MM-DD, when it has one. */
  fileModifiedIso: string | null;
  /** Today as YYYY-MM-DD. */
  todayIso: string;
}

/**
 * Apply the household slot rules to a CSV-update patch (mutates and returns it).
 *
 * Monthly Zoho catch-up files still carry the old name-box markers
 * ("Yes - 45", "45", "yes", "no") that the 2026-08-22 backfill moved out of
 * the Spouse / Child Name boxes. Two rules keep them out for good:
 *
 *  1. A marker in a slot NAME key never reaches the name box. An age marker
 *     becomes `<slot>_age` (+ has_spouse / has_kids) only when the record has
 *     no age and no DOB for that slot and the file did not supply an age
 *     column; "yes" / "no" become the flags. A name box holding a real name
 *     is never overwritten by a marker.
 *  2. Any changed `<slot>_age` without a companion `<slot>_age_as_of` in the
 *     patch gets one — null when the age is cleared, else the file's Modified
 *     Time, else today. Carrying the date in the write itself (rather than
 *     leaving it to the trigger) means the rollback ledger captures the
 *     previous date and can restore it exactly.
 */
export function applyHouseholdCsvRules(
  patch: Record<string, unknown>,
  existing: Record<string, unknown>,
  opts: HouseholdCsvRuleOptions,
): Record<string, unknown> {
  for (const slot of HOUSEHOLD_SLOTS) {
    const flagKey = slot === 'spouse' ? 'has_spouse' : 'has_kids';
    const ageKey = `${slot}_age`;
    const nameVal = patch[slot];
    if (typeof nameVal === 'string') {
      const ageMatch = HOUSEHOLD_MARKER_AGE_RE.exec(nameVal);
      if (ageMatch) {
        delete patch[slot];
        const age = Number(ageMatch[1]);
        if (
          age <= 110 &&
          patch[ageKey] === undefined &&
          isBlank(existing[ageKey]) &&
          isBlank(existing[`${slot}_dob`])
        ) {
          patch[ageKey] = age;
        }
        if (existing[flagKey] !== true) patch[flagKey] = true;
      } else if (HOUSEHOLD_MARKER_YES_RE.test(nameVal)) {
        delete patch[slot];
        if (existing[flagKey] !== true) patch[flagKey] = true;
      } else if (HOUSEHOLD_MARKER_NO_RE.test(nameVal)) {
        delete patch[slot];
        if (slot === 'spouse' && isBlank(existing.has_spouse)) patch.has_spouse = false;
      }
    }
  }

  for (const slot of HOUSEHOLD_SLOTS) {
    const ageKey = `${slot}_age`;
    const asOfKey = `${slot}_age_as_of`;
    if (!(ageKey in patch) || asOfKey in patch) continue;
    patch[asOfKey] = isBlank(patch[ageKey]) ? null : (opts.fileModifiedIso ?? opts.todayIso);
  }
  return patch;
}

export interface RecordedAge {
  /** The age as stored. */
  stored: number;
  /** When it was recorded, if known. */
  asOf: Date | null;
  /** Best estimate of the age today (stored + whole years elapsed). */
  current: number;
  /** Short caption for the record page; null when there is nothing to add. */
  hint: string | null;
}

function parseDateOnly(raw: unknown): Date | null {
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim());
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function wholeYearsBetween(from: Date, to: Date): number {
  let years = to.getFullYear() - from.getFullYear();
  const beforeAnniversary =
    to.getMonth() < from.getMonth() ||
    (to.getMonth() === from.getMonth() && to.getDate() < from.getDate());
  if (beforeAnniversary) years -= 1;
  return Math.max(0, years);
}

/**
 * Describe a household member's recorded age for display.
 *
 * An age typed in without a date of birth goes stale silently — a "45"
 * written three years ago is a 48-year-old today. The trigger keeps the
 * recorded-on date; this turns the pair into what a rep needs to see:
 * the number that was written, and what it most likely is now.
 *
 * Returns null when `key` is not a household age key or the value is not a
 * number, so the caller falls back to its default rendering.
 */
export function describeRecordedAge(
  key: string,
  value: unknown,
  related: Record<string, unknown> | null | undefined,
  now: Date = new Date(),
): RecordedAge | null {
  const slot = householdAgeSlot(key);
  if (!slot) return null;
  if (value === null || value === undefined) return null;
  const text = typeof value === 'number' ? null : String(value).trim();
  if (text === '') return null;
  const stored = typeof value === 'number' ? value : Number(text);
  if (!Number.isFinite(stored)) return null;

  const asOf = parseDateOnly(related?.[`${slot}_age_as_of`]);
  if (!asOf) return { stored, asOf: null, current: stored, hint: null };

  const elapsed = wholeYearsBetween(asOf, now);
  const current = stored + elapsed;
  const recorded = `recorded ${format(asOf, 'MMM yyyy')}`;
  return {
    stored,
    asOf,
    current,
    hint: elapsed > 0 ? `≈ ${current} today · ${recorded}` : recorded,
  };
}
