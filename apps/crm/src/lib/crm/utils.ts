/**
 * CRM Utility Functions
 */

import { normalizeOptions } from './field-options';

/** Clinical sex options for medical / actuarial / eligibility Gender fields. */
export const CLINICAL_GENDER_OPTIONS = ['Male', 'Female'] as const;

/** True for Gender fields that must only offer Male / Female. */
export function isClinicalGenderFieldKey(fieldKey?: string | null): boolean {
  const key = (fieldKey ?? '').trim().toLowerCase();
  if (!key) return false;
  return key === 'gender' || key === 'primary_member_gender' || key.endsWith('_gender');
}

/**
 * Safely extract options array from field.options
 * Handles cases where options might be a string, object, or undefined.
 * This prevents "map is not a function" errors when field.options
 * comes from the database in unexpected formats.
 *
 * When `fieldKey` is a Gender field, always returns Male/Female only —
 * never "Other" / "Prefer not to say" — even if crm_fields still has a
 * wider picklist (migration lag or a prior seed).
 *
 * @param options - The options value from a CRM field (can be array, string, or unknown)
 * @param fieldKey - Optional field key (e.g. `gender`) for clinical filtering
 * @returns A string array that is safe to iterate over
 *
 * @example
 * // All of these return a valid array:
 * getFieldOptions(['a', 'b'])     // ['a', 'b']
 * getFieldOptions('["a","b"]')    // ['a', 'b'] (JSON string)
 * getFieldOptions('a, b, c')      // ['a', 'b', 'c'] (comma-separated)
 * getFieldOptions(undefined)      // []
 * getFieldOptions(null)           // []
 * getFieldOptions({})             // []
 * getFieldOptions(['Male','Female','Other'], 'gender') // ['Male','Female']
 */
export function getFieldOptions(options: unknown, fieldKey?: string | null): string[] {
  return getFieldOptionChoices(options, fieldKey).map((o) => o.value);
}

/** One offered picklist choice: the value stored on the record + what reps read. */
export interface FieldOptionChoice {
  value: string;
  label: string;
}

/**
 * The picklist choices a field offers, as value/label pairs.
 *
 * `crm_fields.options` has two live storage shapes and BOTH must be read here:
 *   - the legacy plain-string list  `["Bronze","Silver"]`
 *   - the curated object list       `[{ id, value, label, is_active, … }]`
 *     written by Dropdown lists (`lib/crm/field-options.ts`)
 *
 * Reading the object shape with `String(entry)` yields `"[object Object]"` for
 * every entry — five identical, unselectable choices in one dropdown (and, in
 * React, five children with the same key). `normalizeOptions` is the canonical
 * reader for both shapes, so this defers to it rather than growing a second
 * parser: labels survive, values stay the codes records actually store, and
 * options that were curated away (`is_active: false`) stop being offered
 * without being deleted.
 *
 * The returned list is unique by value — a legacy array holding the same
 * spelling twice is one choice, not two identical rows.
 */
export function getFieldOptionChoices(
  options: unknown,
  fieldKey?: string | null,
): FieldOptionChoice[] {
  if (isClinicalGenderFieldKey(fieldKey)) {
    return CLINICAL_GENDER_OPTIONS.map((v) => ({ value: v, label: v }));
  }

  const entries = toRawOptionEntries(options);
  const choices: FieldOptionChoice[] = [];
  const seen = new Set<string>();
  for (const option of normalizeOptions(entries)) {
    if (!option.is_active) continue;
    if (!option.value) continue;
    if (seen.has(option.value)) continue;
    seen.add(option.value);
    choices.push({ value: option.value, label: option.label || option.value });
  }
  return choices;
}

/**
 * Coerce whatever sits in `crm_fields.options` into the array
 * `normalizeOptions` expects. Entries stay untouched (string OR object) —
 * only the container is unwrapped.
 */
function toRawOptionEntries(options: unknown): unknown[] {
  if (Array.isArray(options)) return options.map(coerceOptionEntry);

  if (typeof options === 'string') {
    const trimmed = options.trim();
    if (!trimmed) return [];

    // A JSON array string — of strings or of curated option objects.
    if (trimmed.startsWith('[')) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map(coerceOptionEntry);
      } catch {
        // Not valid JSON, fall through to comma-separated handling
      }
    }

    // Treat as comma-separated values
    return trimmed
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // For any other type (null, undefined, object, etc.), there is nothing to offer
  return [];
}

/**
 * A stored list may mix curated option objects with bare scalars (a number
 * picklist, a boolean seeded years ago). Objects go to `normalizeOptions`
 * untouched; every other non-null primitive keeps its old `String(...)`
 * reading so those lists still offer the same choices they always did.
 */
function coerceOptionEntry(entry: unknown): unknown {
  if (entry === null || entry === undefined) return '';
  if (typeof entry === 'object') return entry;
  return String(entry);
}

export interface SelectOptionWithCurrent {
  value: string;
  label: string;
}

/**
 * Select options that always include the value currently stored on the
 * record. Mirrors `usStateOptionsWith` (lib/crm/us-states): a legacy spelling
 * that is not in `crm_fields.options` (e.g. "Sedera Access+ (legacy)") is
 * prepended as its own option so a closed Select can DISPLAY it instead of
 * blanking — it is never rewritten, the user has to pick something else for
 * it to change. Blank / whitespace current values add nothing.
 */
export function optionsWithCurrent(
  options: readonly string[],
  current: string | null | undefined,
): SelectOptionWithCurrent[] {
  return choicesWithCurrent(
    options.map((o) => ({ value: o, label: o })),
    current,
  );
}

/**
 * {@link optionsWithCurrent} for value/label choices — the curated picklist
 * shape. Same rule: a stored value that is not offered is prepended as its own
 * choice (labelled with the raw value, which is all we know about it) so the
 * closed Select shows it instead of blanking.
 */
export function choicesWithCurrent(
  choices: readonly FieldOptionChoice[],
  current: string | null | undefined,
): SelectOptionWithCurrent[] {
  const base = choices.map((o) => ({ value: o.value, label: o.label }));
  const t = String(current ?? '').trim();
  if (!t || base.some((o) => o.value === t)) return base;
  return [{ value: t, label: t }, ...base];
}
