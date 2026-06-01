/**
 * Resolve CRM report/list filter fields to PostgREST column paths.
 * Matches list-view behavior in `getRecords` (queries.ts).
 */

const CRM_RECORD_SYSTEM_FIELDS = new Set([
  'title',
  'status',
  'stage',
  'email',
  'phone',
  'created_at',
  'updated_at',
  'owner_id',
  'market_type',
  'normalization_status',
  'normalized_advisor_name',
  'normalized_agent_name',
  'canonical_advisor_id',
  'import_source',
  'source_record_id',
  'estimated_age',
  'age_range',
  'age_is_estimated',
  'carrier_id',
  'record_type',
  'tobacco_user',
  'advisor_id',
  'contact_type',
  'territory_id',
  'original_start_date',
  'current_year_start_date',
  'cancellation_date',
  'group_name',
]);

/** Legacy JSONB-only fields that reports often filter/sort by name. */
const CRM_RECORD_FIELD_ALIASES: Record<string, string> = {
  start_date: 'original_start_date',
  /** Row `status` is canonical; JSONB keys are display aliases. */
  contact_status: 'status',
  lead_status: 'status',
};

/**
 * Map a user-facing field name to a queryable path on `crm_records`.
 * Used by list views, reports, and exports for filters and sort order.
 * Returns null when the field cannot be queried (e.g. bare `start_date` column).
 */
export function resolveCrmRecordFilterField(field: string, table: string): string | null {
  if (table !== 'crm_records') return field;

  if (CRM_RECORD_SYSTEM_FIELDS.has(field)) {
    return field;
  }

  if (CRM_RECORD_FIELD_ALIASES[field]) {
    return CRM_RECORD_FIELD_ALIASES[field];
  }

  // Custom module fields live in JSONB.
  return `data->>${field}`;
}

export function isCrmRecordsTable(table: string): boolean {
  return table === 'crm_records';
}

/** Alias — same resolver drives list/report filters and sort columns. */
export const resolveCrmRecordQueryField = resolveCrmRecordFilterField;
