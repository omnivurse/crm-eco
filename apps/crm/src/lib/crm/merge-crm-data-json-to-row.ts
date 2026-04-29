import { CRM_DATA_JSONB_KEYS_SYNCED_TO_ROW_ON_PATCH } from '@/lib/crm/record-form-defaults';

export interface MergeCrmDataJsonContext {
  /** For PATCH: previous row title when first/last clear. */
  previousTitle?: string | null;
}

/**
 * The indexed columns these keys map to are typed (UUID, DATE, enum,
 * boolean). Postgres rejects empty strings for those types with
 * `invalid input syntax for type …`, so any blank-like value coming
 * out of the form must land as `null` instead. Text columns are
 * included too — `""` and `null` are equivalent there and coercing
 * yields cleaner reads downstream.
 */
export function normalizeRowColumnValue(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') {
      return null;
    }
    return value;
  }
  return value;
}

/**
 * Maps JSONB `data` onto indexed `crm_records` columns (shared by POST and PATCH).
 */
export function mergeCrmDataJsonIntoRowColumns(
  d: Record<string, unknown>,
  ctx: MergeCrmDataJsonContext = {}
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};

  if (d.email !== undefined) updates.email = d.email || null;
  if (d.phone !== undefined) updates.phone = d.phone || null;

  // Title prefers `preferred_name` (nickname / commonly-used name) over the
  // legal `first_name`. Legal first_name is preserved on the record for
  // enrollment / carrier compliance, but the displayed title surfaces what
  // the contact actually goes by.
  if (
    d.first_name !== undefined ||
    d.last_name !== undefined ||
    d.preferred_name !== undefined
  ) {
    const preferred = (d.preferred_name as string) || '';
    const first = (d.first_name as string) || '';
    const last = (d.last_name as string) || '';
    const displayFirst = preferred || first;
    updates.title =
      ([displayFirst, last].filter(Boolean).join(' ') || ctx.previousTitle) ?? null;
  }

  // Status precedence: lead_status FIRST, then contact_status overrides, then
  // explicit `status` overrides everything. Reason: when a lead is converted
  // to a contact, the lead row keeps `lead_status='Converted'` forever as
  // history. The new contact row inherits that value in its JSONB during
  // conversion / form round-trip. If lead_status ran *after* contact_status,
  // every save on a converted contact would silently revert their live
  // contact_status back to "Converted" — exactly the bug Wendy reported on
  // Barry Donath ("change to Pending, reverts back to Converted"). Running
  // contact_status last makes the contact's live status authoritative.
  if (d.lead_status !== undefined) updates.status = d.lead_status || null;
  if (d.contact_status !== undefined) updates.status = d.contact_status || null;
  if (d.status !== undefined) updates.status = d.status || null;

  for (const key of CRM_DATA_JSONB_KEYS_SYNCED_TO_ROW_ON_PATCH) {
    if (d[key] !== undefined) {
      updates[key] = normalizeRowColumnValue(d[key]);
    }
  }

  // Deals / accounts: display name only in JSONB
  if (d.title !== undefined) {
    updates.title = ((d.title as string) || ctx.previousTitle) ?? null;
  }
  if (d.name !== undefined && updates.title === undefined) {
    updates.title = ((d.name as string) || ctx.previousTitle) ?? null;
  }

  return updates;
}
