/**
 * Canonical display-name resolution for CRM records.
 *
 * When `crm_records.title` is null (common for records created before the
 * `mergeCrmDataJsonIntoRowColumns` pipeline was wired, or for imports that
 * didn't populate the column), the UI should derive a human-readable name
 * from the JSONB `data` payload instead of showing "Untitled".
 *
 * Priority order (matches `mergeCrmDataJsonIntoRowColumns`):
 *   1. `record.title`  (indexed column — authoritative when populated)
 *   2. `data.preferred_name` + `data.last_name`
 *   3. `data.first_name` + `data.last_name`
 *   4. `data.account_name`
 *   5. `data.name`
 *   6. `data.deal_name`
 *   7. Fallback: 'Untitled'
 */

import type { CrmRecord } from './types';

export function getRecordDisplayName(record: CrmRecord): string {
  // 1. Title column is authoritative when it's a real value
  if (record.title && record.title !== 'Untitled') return record.title;

  // 2–3. Derive from person-name fields in JSONB data
  const d = record.data as Record<string, unknown> | undefined;
  if (d) {
    const preferred = typeof d.preferred_name === 'string' ? d.preferred_name.trim() : '';
    const first = typeof d.first_name === 'string' ? d.first_name.trim() : '';
    const last = typeof d.last_name === 'string' ? d.last_name.trim() : '';
    const displayFirst = preferred || first;
    const fullName = [displayFirst, last].filter(Boolean).join(' ');
    if (fullName) return fullName;

    // 4–6. Entity-style name fallbacks
    if (typeof d.account_name === 'string' && d.account_name.trim()) return d.account_name.trim();
    if (typeof d.name === 'string' && d.name.trim()) return d.name.trim();
    if (typeof d.deal_name === 'string' && d.deal_name.trim()) return d.deal_name.trim();
  }

  // 7. Last resort — if title is set but is literally "Untitled", return it;
  //    otherwise fall back to the constant.
  return record.title || 'Untitled';
}
