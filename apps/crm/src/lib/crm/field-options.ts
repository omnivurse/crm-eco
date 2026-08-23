/**
 * Pure picklist-option logic shared by the field-options API route and the
 * curation UI. Options live as a JSONB array on `crm_fields.options` — there
 * is deliberately NO second physical table (see the route header comment).
 *
 * Everything here is pure: no I/O, no Supabase, no Next. The route persists
 * results; the UI can preview them.
 *
 * Invariants enforced by validateOptions:
 *  - the list is never left empty, and never left with zero ACTIVE options
 *  - option values are non-empty and unique within the field
 *    (case-insensitively, trimmed — "Silver PPO" and "silver ppo" collide)
 *  - labels are non-empty and both value/label fit in 255 chars
 *
 * Deactivate, never hard-delete: records may hold an option's value, so a
 * curated-away option is kept with is_active=false and simply stops being
 * offered for new picks.
 */

export interface FieldOption {
  id: string;
  value: string;
  label: string;
  color: string | null;
  icon: string | null;
  is_default: boolean;
  is_active: boolean;
  display_order: number;
  metadata: Record<string, unknown>;
}

/** Max length for option value and label (mirrors the route's zod schema). */
export const OPTION_TEXT_MAX = 255;

/** FNV-1a 32-bit hash, seeded — tiny, pure, identical on server and client. */
function fnv1a(input: string, seed: number): number {
  let hash = (0x811c9dc5 ^ seed) >>> 0;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Deterministic UUID-shaped id for a legacy option that has none stored —
 * derived from the trimmed value (plus the occurrence index, so exact
 * duplicate values still get distinct ids). Every read of the same stored
 * list yields the SAME ids, which is what lets a rename/hide round-trip
 * GET → PATCH on a legacy string list (prod contacts.product) without the
 * id going stale between requests. A random id here broke exactly that:
 * the first curation attempt on a legacy field always 404ed.
 * The version/variant nibbles are pinned ('5…', '8…') so the result passes
 * the route's zod `.uuid()` schemas.
 */
export function deterministicOptionId(value: string, occurrence = 0): string {
  const key = occurrence === 0 ? value.trim() : `${value.trim()}\u0000${occurrence}`;
  const hex = [fnv1a(key, 0x00000000), fnv1a(key, 0x9e3779b9), fnv1a(key, 0x85ebca6b), fnv1a(key, 0xc2b2ae35)]
    .map((h) => h.toString(16).padStart(8, '0'))
    .join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Coerce whatever currently sits in crm_fields.options into a clean array.
 *
 * Legacy storage shapes we normalize:
 *   - "[]" (the literal string)      → []
 *   - ["Foo","Bar"] (plain strings)  → reshaped into FieldOption objects
 *
 * Deterministic: entries with no stored id get one DERIVED from their value
 * (deterministicOptionId), never a random one — so the ids the UI got from a
 * GET are still valid when its PATCH re-reads the same stored list.
 */
export function normalizeOptions(raw: unknown): FieldOption[] {
  if (!raw) return [];
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];

  // Occurrence counter per trimmed value, so exact duplicates in a legacy
  // list still map to stable, distinct ids (stored arrays keep their order).
  const occurrences = new Map<string, number>();
  const derivedId = (value: string): string => {
    const key = value.trim();
    const n = occurrences.get(key) ?? 0;
    occurrences.set(key, n + 1);
    return deterministicOptionId(value, n);
  };

  return parsed.map((entry, idx): FieldOption => {
    if (typeof entry === 'string') {
      return {
        id: derivedId(entry),
        value: entry,
        label: entry,
        color: null,
        icon: null,
        is_default: false,
        is_active: true,
        display_order: idx,
        metadata: {},
      };
    }
    const obj = (entry ?? {}) as Record<string, unknown>;
    const value = String(obj.value ?? obj.label ?? '');
    return {
      id: (obj.id as string) || derivedId(value),
      value,
      label: String(obj.label ?? obj.value ?? ''),
      color: (obj.color as string | null | undefined) ?? null,
      icon: (obj.icon as string | null | undefined) ?? null,
      is_default: Boolean(obj.is_default),
      is_active: obj.is_active === undefined ? true : Boolean(obj.is_active),
      display_order: typeof obj.display_order === 'number' ? obj.display_order : idx,
      metadata: (obj.metadata as Record<string, unknown> | undefined) ?? {},
    };
  });
}

/** Sort by display_order then label so the wire order is stable. */
export function sortOptions(opts: FieldOption[]): FieldOption[] {
  return [...opts].sort((a, b) => {
    if (a.display_order !== b.display_order) return a.display_order - b.display_order;
    return a.label.localeCompare(b.label);
  });
}

/** Case-insensitive, trimmed key used for value uniqueness. */
function valueKey(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Validate a full option list before it is persisted.
 * Returns an error message, or null when the list is valid.
 */
export function validateOptions(options: FieldOption[]): string | null {
  if (options.length === 0) {
    return 'A picklist must keep at least one option';
  }
  if (!options.some((o) => o.is_active)) {
    return 'A picklist must keep at least one active option';
  }
  const seen = new Set<string>();
  for (const o of options) {
    if (!o.value.trim()) return 'Option values must not be empty';
    if (!o.label.trim()) return 'Option labels must not be empty';
    if (o.value.length > OPTION_TEXT_MAX || o.label.length > OPTION_TEXT_MAX) {
      return `Option values and labels must be at most ${OPTION_TEXT_MAX} characters`;
    }
    const key = valueKey(o.value);
    if (seen.has(key)) return `Duplicate option value: ${o.value.trim()}`;
    seen.add(key);
  }
  return null;
}

/** One idempotent update to an existing option. `value` is deliberately NOT
 * patchable — records store the value, so renames touch only the label. */
export interface OptionPatch {
  id: string;
  label?: string;
  is_active?: boolean;
  display_order?: number;
  color?: string | null;
  icon?: string | null;
  is_default?: boolean;
  metadata?: Record<string, unknown>;
}

export type OptionsResult = { options: FieldOption[]; error?: undefined } | { options?: undefined; error: string };

/**
 * Apply one or more patches (rename / deactivate / reactivate / reorder).
 * Pure and idempotent: applying the same patches twice yields the same list.
 * Unknown option ids are an error (nothing is applied), and the resulting
 * list is validated as a whole.
 */
export function applyOptionPatches(options: FieldOption[], patches: OptionPatch[]): OptionsResult {
  const byId = new Map(options.map((o) => [o.id, o]));
  for (const patch of patches) {
    const current = byId.get(patch.id);
    if (!current) return { error: `Option not found: ${patch.id}` };
    byId.set(patch.id, {
      ...current,
      ...(patch.label !== undefined && { label: patch.label }),
      ...(patch.is_active !== undefined && { is_active: patch.is_active }),
      ...(patch.display_order !== undefined && { display_order: patch.display_order }),
      ...(patch.color !== undefined && { color: patch.color }),
      ...(patch.icon !== undefined && { icon: patch.icon }),
      ...(patch.is_default !== undefined && { is_default: patch.is_default }),
      ...(patch.metadata !== undefined && { metadata: patch.metadata }),
    });
  }
  const next = options.map((o) => byId.get(o.id)!);
  const error = validateOptions(next);
  if (error) return { error };
  return { options: next };
}

/**
 * Merge one option (the loser) into another (the winner) — FOR THE OPTION
 * LIST ONLY. The loser is deactivated (never removed) and the winner stays
 * active. This function must NOT rewrite any crm_records values, and it does
 * not: records that hold the loser's value keep it until a separate,
 * explicitly approved data migration re-points them. Idempotent — merging an
 * already-inactive loser again is a no-op.
 */
export function mergeOptionInto(options: FieldOption[], loserId: string, winnerId: string): OptionsResult {
  if (loserId === winnerId) return { error: 'Cannot merge an option into itself' };
  const loser = options.find((o) => o.id === loserId);
  const winner = options.find((o) => o.id === winnerId);
  if (!loser) return { error: `Option not found: ${loserId}` };
  if (!winner) return { error: `Option not found: ${winnerId}` };
  return applyOptionPatches(options, [
    { id: loserId, is_active: false, is_default: false },
    { id: winnerId, is_active: true },
  ]);
}
