/**
 * Dirty-key patch builder for CRM record edit forms.
 *
 * The edit page seeds its form from `mergeCrmRecordRowIntoFormDefaults` — JSONB
 * `data` plus twin overlay, indexed-column overlays and legacy-key projections.
 * Sending the whole form back on save would (a) write every projected /
 * overlaid value back as a real key and (b) let `sanitizeCrmDataJsonPatch`
 * null out legacy non-ISO date strings the form only displays as blank.
 *
 * `buildRecordDataPatch` returns ONLY the keys the rep actually changed, so the
 * server-side `{ ...prevData, ...patch }` merge leaves everything else alone.
 *
 * Pure module — no server imports, safe for client components.
 */

export interface BuildRecordDataPatchOptions {
  /**
   * Keys that must always be included in the patch when present in
   * `currentValues`, even if unchanged (e.g. a status the server needs to
   * re-evaluate). Defaults to none.
   */
  alwaysInclude?: readonly string[];
}

/** `undefined`, `null` and whitespace-only strings all read as "blank" in the form. */
export function isBlankFormValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  return false;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Structural equality for form values. Blank primitives compare equal to each
 * other; arrays and plain objects are compared deeply (object key order does
 * not matter); Dates compare by time; everything else uses `Object.is`.
 */
export function formValuesEqual(a: unknown, b: unknown): boolean {
  if (isBlankFormValue(a) && isBlankFormValue(b)) return true;
  if (isBlankFormValue(a) || isBlankFormValue(b)) return false;
  if (Object.is(a, b)) return true;

  if (a instanceof Date || b instanceof Date) {
    if (!(a instanceof Date) || !(b instanceof Date)) return false;
    return a.getTime() === b.getTime();
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!formValuesEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (isPlainObject(a) || isPlainObject(b)) {
    if (!isPlainObject(a) || !isPlainObject(b)) return false;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      if (!formValuesEqual(a[key], b[key])) return false;
    }
    return true;
  }

  return false;
}

/**
 * Compute the JSONB `data` patch for a record edit save.
 *
 * - Unchanged keys (deep-equal, blank ≡ blank) are omitted.
 * - Changed keys carry the current value.
 * - Keys added in the form (absent/blank initially, non-blank now) are included.
 * - Intentional clears (non-blank → blank) are emitted as `null` so the server
 *   merge actually removes the value instead of keeping the old one.
 * - Keys that exist only in `initialValues` and are absent from
 *   `currentValues` are NOT treated as clears — the form simply did not render
 *   them (projected/legacy keys), so they must be left untouched.
 */
export function buildRecordDataPatch(
  initialValues: Record<string, unknown> | null | undefined,
  currentValues: Record<string, unknown> | null | undefined,
  opts?: BuildRecordDataPatchOptions,
): Record<string, unknown> {
  const initial = initialValues ?? {};
  const current = currentValues ?? {};
  const patch: Record<string, unknown> = {};

  for (const key of Object.keys(current)) {
    const next = current[key];
    const prev = initial[key];
    if (formValuesEqual(prev, next)) continue;
    patch[key] = isBlankFormValue(next) ? null : next;
  }

  if (opts?.alwaysInclude) {
    for (const key of opts.alwaysInclude) {
      if (key in patch) continue;
      if (!Object.prototype.hasOwnProperty.call(current, key)) continue;
      const value = current[key];
      patch[key] = isBlankFormValue(value) ? null : value;
    }
  }

  return patch;
}

/** True when the patch carries no keys (nothing to send). */
export function isEmptyRecordDataPatch(patch: Record<string, unknown>): boolean {
  return Object.keys(patch).length === 0;
}
