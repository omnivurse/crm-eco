import { CRM_DATA_JSONB_KEYS_SYNCED_TO_ROW_ON_PATCH } from '@/lib/crm/record-form-defaults';

export interface MergeCrmDataJsonContext {
  /** For PATCH: previous row title when first/last clear. */
  previousTitle?: string | null;
  /**
   * `crm_modules.key` for the record. When `'contacts'`, `lead_status` in
   * JSONB is treated as historical (converted leads) and must not drive
   * `crm_records.status` — only `contact_status` / explicit `data.status`
   * do. The same applies to the **members** module (it uses `contact_status`
   * for operational status, not `lead_status`).
   */
  moduleKey?: string | null;
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

  // Status: for **leads** (and other non-person modules), lead_status → row,
  // then contact_status overrides, then explicit `data.status`. For **contacts**
  // and **members**, never map legacy `lead_status` onto the row — converted
  // rows often keep `lead_status: "Converted"` as history while the live field
  // is `contact_status`. Partial PATCHes merge into existing JSONB; without
  // this guard, `lead_status` could still drive the row when `contact_status`
  // was omitted from a patch payload.
  const personContactStyleModule =
    ctx.moduleKey === 'contacts' || ctx.moduleKey === 'members';
  if (!personContactStyleModule && d.lead_status !== undefined) {
    updates.status = d.lead_status || null;
  }
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
