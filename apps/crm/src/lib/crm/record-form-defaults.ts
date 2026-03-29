/**
 * CRM record forms primarily edit JSONB `data`, but many important fields live on
 * `crm_records` as indexed columns (market_type, carrier_id, normalization_*, etc.).
 * Those columns are the source of truth for filters, RPCs, and triggers — JSONB
 * copies can be stale. This module merges row → form defaults so reads/saves stay consistent.
 */

/** Top-level crm_records columns that map to form field keys (same key in `data` when duplicated). */
export const CRM_ROW_FIELDS_MERGED_INTO_FORM = [
  'market_type',
  'carrier_id',
  'normalization_status',
  'normalization_notes',
  'canonical_advisor_id',
  'normalized_advisor_name',
  'normalized_agent_name',
  'tobacco_user',
  'record_type',
  'import_source',
  'owner_id',
  'stage',
  'advisor_id',
  'contact_type',
  'territory_id',
  'source_record_id',
  'import_batch_id',
  'original_start_date',
  'current_year_start_date',
  'cancellation_date',
  'group_name',
] as const;

/**
 * On PATCH, copy these keys from JSONB `body.data` onto indexed `crm_records` columns.
 * Excludes `owner_id` (use body.owner_id + profile sync) and `stage` (use transition API / body.stage + blueprint rules).
 */
export const CRM_DATA_JSONB_KEYS_SYNCED_TO_ROW_ON_PATCH: readonly string[] = [
  'market_type',
  'carrier_id',
  'normalization_status',
  'normalization_notes',
  'canonical_advisor_id',
  'normalized_advisor_name',
  'normalized_agent_name',
  'tobacco_user',
  'record_type',
  'import_source',
  'advisor_id',
  'contact_type',
  'territory_id',
  'source_record_id',
  'import_batch_id',
  'original_start_date',
  'current_year_start_date',
  'cancellation_date',
  'group_name',
];

/**
 * Build the object used to initialize record edit forms and read-only field views:
 * start from JSONB `data`, then overlay indexed columns (authoritative), then
 * common top-level mirrors (email/phone/status).
 */
export function mergeCrmRecordRowIntoFormDefaults(
  row: Record<string, unknown> & {
    data?: Record<string, unknown> | null;
    email?: string | null;
    phone?: string | null;
    status?: string | null;
  }
): Record<string, unknown> {
  const raw = row.data;
  const base =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? { ...raw }
      : {};

  // Indexed columns override JSONB when present on the row (source of truth)
  for (const key of CRM_ROW_FIELDS_MERGED_INTO_FORM) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      base[key] = (row as Record<string, unknown>)[key];
    }
  }

  if (row.email != null && row.email !== '' && base.email == null) {
    base.email = row.email;
  }
  if (row.phone != null && row.phone !== '' && base.phone == null) {
    base.phone = row.phone;
  }
  if (row.status != null && row.status !== '') {
    if (base.contact_status == null && base.lead_status == null) {
      base.contact_status = row.status;
    }
  }

  return base;
}
