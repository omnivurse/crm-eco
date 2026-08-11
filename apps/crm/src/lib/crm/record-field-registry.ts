/**
 * Single source of truth for which `crm_records` keys are top-level columns
 * vs JSONB `data` fields. Create/patch/client save must import from here —
 * do not duplicate allowlists.
 */

/** Indexed columns that inline editors and PATCH may set at the row root. */
export const CRM_RECORD_ROW_COLUMN_KEYS = [
  'title',
  'status',
  'stage',
  'owner_id',
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
  // Derived migration wave — a real column, so inline edits and PATCH must
  // route it to the row rather than writing a shadow copy into `data`.
  'record_origin',
] as const;

export type CrmRecordRowColumnKey = (typeof CRM_RECORD_ROW_COLUMN_KEYS)[number];

/**
 * Canonical top-level keys accepted by `executeCrmRecordPatch` when the client
 * sends them outside `data` (excludes title/status/stage/owner_id which have
 * dedicated handling in the patch service).
 */
export const CRM_RECORD_PATCH_CANONICAL_KEYS = [
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
] as const;

export const CRM_RECORD_DATE_COLUMN_KEYS = new Set<string>([
  'original_start_date',
  'current_year_start_date',
  'cancellation_date',
]);

export const CRM_RECORD_UUID_COLUMN_KEYS = new Set<string>([
  'carrier_id',
  'canonical_advisor_id',
  'advisor_id',
  'territory_id',
  'source_record_id',
  'import_batch_id',
]);

const ROW_COLUMN_SET = new Set<string>(CRM_RECORD_ROW_COLUMN_KEYS);

/** Whether an inline/PATCH field key targets a row column or JSONB `data`. */
export function resolveFieldSaveTarget(field: string): 'row' | 'data' {
  return ROW_COLUMN_SET.has(field) ? 'row' : 'data';
}
