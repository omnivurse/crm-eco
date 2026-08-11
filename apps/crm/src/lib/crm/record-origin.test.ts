/**
 * record_origin must stay sortable, filterable, and row-routed.
 *
 * It is a real crm_records column (20260811223000_crm_record_origin_tier), not
 * a JSONB key. Three registries have to agree or it silently breaks:
 *   - CRM_RECORD_SYSTEM_FIELDS  -> resolves to the column, so list views and
 *     reports can ORDER BY / filter on it. Without it the resolver falls
 *     through to `data->>record_origin`, which does not exist, and every
 *     filter quietly matches nothing.
 *   - CRM_RECORD_ROW_COLUMN_KEYS -> inline edits write the column instead of a
 *     shadow copy inside `data`.
 *   - CRM_ROW_FIELDS_MERGED_INTO_FORM -> the record page can display it.
 */
import { describe, it, expect } from 'vitest';

import { resolveCrmRecordFilterField } from './report-field-path';
import {
  CRM_RECORD_ROW_COLUMN_KEYS,
  resolveFieldSaveTarget,
} from './record-field-registry';
import { CRM_ROW_FIELDS_MERGED_INTO_FORM } from './record-form-defaults';

describe('record_origin wiring', () => {
  it('resolves to the real column, not a JSONB path', () => {
    expect(resolveCrmRecordFilterField('record_origin', 'crm_records')).toBe(
      'record_origin',
    );
  });

  it('is routed to the row on inline edit / PATCH', () => {
    expect(CRM_RECORD_ROW_COLUMN_KEYS).toContain('record_origin');
    expect(resolveFieldSaveTarget('record_origin')).toBe('row');
  });

  it('is merged into record form defaults so the page can show it', () => {
    expect(CRM_ROW_FIELDS_MERGED_INTO_FORM).toContain('record_origin');
  });

  it('sorts oldest wave first via the numeric prefix', () => {
    // Mirrors crm_record_origin_for() in the migration. The prefixes exist so
    // a plain lexicographic ORDER BY groups waves chronologically rather than
    // alphabetically (which would put "enrollment" before "legacy").
    const waves = [
      '4_enrollment',
      '2_legacy_zoho',
      '5_native',
      '1_legacy_zoho_leads',
      '3_csv_import',
    ];
    expect([...waves].sort()).toEqual([
      '1_legacy_zoho_leads',
      '2_legacy_zoho',
      '3_csv_import',
      '4_enrollment',
      '5_native',
    ]);
  });
});
