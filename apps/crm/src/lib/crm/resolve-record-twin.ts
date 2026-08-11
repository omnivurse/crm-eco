/**
 * Cross-module record twins.
 *
 * The Jan–Mar 2026 bulk import created a Members-module `crm_records` row for
 * ~1,060 people who ALSO have a Contacts-module row. The Members copy is a
 * strict subset for 1,039 of them — averaging 67 fewer populated fields — so a
 * rep who opens the Members twin sees a near-empty profile for a member whose
 * data is complete one module over. (Measured against live PIF-ECO-V2.)
 *
 * This module resolves that twin and overlays it as a READ-ONLY fallback layer:
 * the record's own values always win, the twin only fills blanks. Nothing is
 * written back — there is deliberately no second copy of the data.
 *
 * Matching reuses `memberMatchesCrmRecord` (member number → email → email2 →
 * phone+name) so twin resolution here and member→CRM resolution elsewhere can
 * never disagree.
 */

import {
  memberMatchesCrmRecord,
  type MemberCrmLookupInput,
  type MemberCrmRecordCandidate,
} from './resolve-member-crm-record';

/** The record being viewed, as stored in `crm_records`. */
export interface TwinSourceRow {
  id: string;
  email?: string | null;
  phone?: string | null;
  data?: Record<string, unknown> | null;
}

/**
 * Keys that describe THIS ROW rather than the person: provenance, sync
 * bookkeeping, and pointers to other records. Copying them from a twin would
 * attribute the Contact's Zoho lineage / audit trail to the Member row, so they
 * are never overlaid even when blank.
 */
export const TWIN_OVERLAY_EXCLUDED_KEYS: ReadonlySet<string> = new Set([
  'id',
  'record_id',
  'zoho_record_id',
  'zoho_module',
  'zoho_created_time',
  'zoho_modified_time',
  'zoho_contact_owner_id',
  'created_by',
  'created_by_id',
  'created_by_name',
  'modified_by',
  'modified_by_id',
  'modified_by_name',
  'created_time',
  'modified_time',
  'last_activity_time',
  'change_log_time',
  'linked_member_id',
  'converted_from_lead_id',
  'converted_member_id',
  'converted_contact_id',
  'source_record_id',
  'locked',
]);

function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function rowData(row: TwinSourceRow): Record<string, unknown> {
  const raw = row.data;
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/**
 * Shape a `crm_records` row into the lookup input the member matcher expects,
 * so a Members-module row can be matched against Contacts-module candidates.
 *
 * Returns null when the row carries no usable identity signal — matching on
 * name alone is not safe enough to merge two people's profiles.
 */
export function buildTwinLookup(row: TwinSourceRow): MemberCrmLookupInput | null {
  const data = rowData(row);
  const memberNumber = str(data.member_number);
  const email = str(row.email) ?? str(data.email);
  const phone = str(row.phone) ?? str(data.phone);
  const firstName = str(data.first_name);
  const lastName = str(data.last_name);

  // Need a strong identifier: member number or email. Phone alone is only
  // accepted by the matcher alongside a full name match.
  const hasStrongId = Boolean(memberNumber || email);
  const hasPhoneName = Boolean(phone && firstName && lastName);
  if (!hasStrongId && !hasPhoneName) return null;

  return {
    id: row.id,
    email,
    phone,
    first_name: firstName,
    last_name: lastName,
    member_number: memberNumber,
  };
}

/** Count populated, person-scoped keys — used to confirm a twin is richer. */
export function countOverlayableKeys(
  data: Record<string, unknown> | null | undefined,
): number {
  if (!data) return 0;
  let n = 0;
  for (const [key, value] of Object.entries(data)) {
    if (TWIN_OVERLAY_EXCLUDED_KEYS.has(key)) continue;
    if (!isBlank(value)) n += 1;
  }
  return n;
}

/**
 * Pick the twin that would actually improve this record.
 *
 * Guards, in order:
 *  - never match a row against itself
 *  - require `memberMatchesCrmRecord` to confirm the same person
 *  - require the twin to be strictly richer, so we never overlay a thinner row
 */
export function pickRicherTwin(
  row: TwinSourceRow,
  candidates: MemberCrmRecordCandidate[],
): MemberCrmRecordCandidate | null {
  const lookup = buildTwinLookup(row);
  if (!lookup) return null;

  const selfScore = countOverlayableKeys(rowData(row));
  let best: MemberCrmRecordCandidate | null = null;
  let bestScore = selfScore;

  for (const candidate of candidates) {
    if (candidate.id === row.id) continue;
    if (!memberMatchesCrmRecord(lookup, candidate).matched) continue;
    const score = countOverlayableKeys(candidate.data);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

/**
 * Overlay twin values onto the record's own data, filling ONLY blanks.
 *
 * The returned object is a new map — neither input is mutated — and every key
 * the record already answers for keeps its own value, so the twin can never
 * override live data a rep has edited on this record.
 */
export function overlayTwinData(
  base: Record<string, unknown>,
  twinData: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!twinData) return { ...base };
  const out = { ...base };
  for (const [key, value] of Object.entries(twinData)) {
    if (TWIN_OVERLAY_EXCLUDED_KEYS.has(key)) continue;
    if (isBlank(value)) continue;
    if (!isBlank(out[key])) continue;
    out[key] = value;
  }
  return out;
}
