import {
  isCrmJsonbDateFieldKey,
  normalizeDateColumnValue,
} from '@/lib/crm/merge-crm-data-json-to-row';
import { bridgeSharingEntityReadPaths } from '@/lib/crm/lead-contact-sharing-fields';
import { bridgeHealthInsuranceReadPaths } from '@/lib/crm/health-insurance-fields';

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
  },
  options?: { moduleKey?: string | null },
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
  // Indexed `status` is canonical. Always overlay onto the module status key so
  // edit/autosave cannot resurrect a stale JSONB value after Kanban/list writes.
  if (row.status != null && row.status !== '') {
    const moduleKey = options?.moduleKey ?? null;
    if (moduleKey === 'leads') {
      base.lead_status = row.status;
    } else if (moduleKey === 'contacts' || moduleKey === 'members') {
      base.contact_status = row.status;
      // Converted leads often keep historical lead_status in JSONB — strip it so
      // form PATCH does not remirror "Converted" onto an Active contact/member.
      delete base.lead_status;
    } else {
      // Other modules: prefer contact_status mirror; clear competing lead_status.
      base.contact_status = row.status;
      if (base.lead_status != null && base.lead_status !== row.status) {
        delete base.lead_status;
      }
    }
    base.status = row.status;
  }

  // Legacy imports may store invalid DOB strings (e.g. 01/00/2000). Normalize
  // so date inputs start empty and reps can clear the field without blocking save.
  for (const key of Object.keys(base)) {
    if (isCrmJsonbDateFieldKey(key)) {
      base[key] = normalizeDateColumnValue(base[key]);
    }
  }

  bridgeSharingEntityReadPaths(base, options?.moduleKey);
  bridgeHealthInsuranceReadPaths(base, options?.moduleKey);

  return base;
}
