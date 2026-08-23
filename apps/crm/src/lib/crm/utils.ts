/**
 * CRM Utility Functions
 */

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
  if (isClinicalGenderFieldKey(fieldKey)) {
    return [...CLINICAL_GENDER_OPTIONS];
  }

  // If already an array, return it directly
  if (Array.isArray(options)) {
    return options.map(String); // Ensure all items are strings
  }

  // If it's a string, try to parse it
  if (typeof options === 'string') {
    const trimmed = options.trim();

    // Empty string
    if (!trimmed) {
      return [];
    }

    // Try parsing as JSON first (could be a JSON array string)
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map(String);
        }
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

  // For any other type (null, undefined, object, etc.), return empty array
  return [];
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
  const base = options.map((o) => ({ value: o, label: o }));
  const t = String(current ?? '').trim();
  if (!t || options.includes(t)) return base;
  return [{ value: t, label: t }, ...base];
}
