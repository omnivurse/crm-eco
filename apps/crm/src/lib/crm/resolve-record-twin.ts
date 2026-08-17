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
// No cycle: legacy-key-projection → coverage-snapshot-plan-fields →
// premium-field-aliases; none of them import this module.
import {
  LEGACY_ALIAS_REJECTS_BY_MODULE,
  MEMBERS_COVERAGE_ALIASES,
} from './legacy-key-projection';

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

// ============================================================================
// Batch (list-page) twin resolution
// ============================================================================
//
// The Members LIST used to show only the row's own JSONB, so plan / effective
// date (which live on the Contacts twin for the imported ~1,060 members) were
// blank until the rep clicked into the record. The helpers below let a list
// page resolve twins for a whole page of rows with a bounded number of
// batched lookups and then apply EXACTLY the same blank-fill overlay the
// detail page uses (`overlayTwinData` via `mergeCrmRecordRowIntoFormDefaults`).
// Nothing is written back.

/** Deduplicated match keys for one page of rows, in row order. */
export interface TwinBatchLookupKeys {
  /** Lower-cased, trimmed primary emails. */
  emails: string[];
  /** Trimmed member numbers. */
  memberNumbers: string[];
}

/**
 * Collect the identity keys a page of rows can be matched on. Rows that carry
 * no strong identifier (see `buildTwinLookup`) contribute nothing, so they can
 * never pick up a twin by name alone.
 */
export function collectTwinLookupKeys(rows: TwinSourceRow[]): TwinBatchLookupKeys {
  const emails = new Set<string>();
  const memberNumbers = new Set<string>();
  for (const row of rows) {
    const lookup = buildTwinLookup(row);
    if (!lookup) continue;
    if (lookup.email) emails.add(lookup.email.toLowerCase());
    if (lookup.member_number) memberNumbers.add(lookup.member_number);
  }
  return { emails: [...emails], memberNumbers: [...memberNumbers] };
}

function candidateData(candidate: MemberCrmRecordCandidate): Record<string, unknown> {
  const raw = candidate.data;
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}

function normalizedEmailKeys(candidate: MemberCrmRecordCandidate): string[] {
  const data = candidateData(candidate);
  const out = new Set<string>();
  for (const value of [candidate.email, data.email, data.secondary_email, data.email2]) {
    const s = str(value);
    if (s) out.add(s.toLowerCase());
  }
  return [...out];
}

/**
 * Resolve the richer twin for every row on a page.
 *
 * Candidates are indexed by email / member number first so the cost is
 * O(rows + candidates) rather than rows × candidates; the actual decision for
 * each row is still `pickRicherTwin` (same-person check via
 * `memberMatchesCrmRecord`, strictly-richer guard, never itself), so a batch
 * resolution can never disagree with the single-record detail path.
 *
 * Returns rowId → twin JSONB for rows that have a richer twin. Rows without a
 * twin are simply absent.
 */
export function pickRicherTwinsForRows(
  rows: TwinSourceRow[],
  candidates: MemberCrmRecordCandidate[],
): Map<string, Record<string, unknown>> {
  const byEmail = new Map<string, MemberCrmRecordCandidate[]>();
  const byMemberNumber = new Map<string, MemberCrmRecordCandidate[]>();
  for (const candidate of candidates) {
    if (!candidate?.id) continue;
    for (const email of normalizedEmailKeys(candidate)) {
      const bucket = byEmail.get(email);
      if (bucket) bucket.push(candidate);
      else byEmail.set(email, [candidate]);
    }
    const memberNumber = str(candidateData(candidate).member_number);
    if (memberNumber) {
      const bucket = byMemberNumber.get(memberNumber);
      if (bucket) bucket.push(candidate);
      else byMemberNumber.set(memberNumber, [candidate]);
    }
  }

  const out = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const lookup = buildTwinLookup(row);
    if (!lookup) continue;
    const pool = new Map<string, MemberCrmRecordCandidate>();
    if (lookup.email) {
      for (const c of byEmail.get(lookup.email.toLowerCase()) ?? []) pool.set(c.id, c);
    }
    if (lookup.member_number) {
      for (const c of byMemberNumber.get(lookup.member_number) ?? []) pool.set(c.id, c);
    }
    if (pool.size === 0) continue;
    const twin = pickRicherTwin(row, [...pool.values()]);
    const twinData = twin?.data;
    if (twinData && typeof twinData === 'object' && !Array.isArray(twinData)) {
      out.set(row.id, twinData as Record<string, unknown>);
    }
  }
  return out;
}

/**
 * Members-module list columns that mean the same thing as a key the twin (or
 * the row itself) already carries under a legacy / health-share name. Same
 * table the members DETAIL page projects through (`projectLegacyKeys`) — see
 * `MEMBERS_COVERAGE_ALIASES` for the field-fill evidence — re-exported here so
 * list callers keep one import.
 */
export const MEMBERS_COVERAGE_LIST_ALIASES: Readonly<Record<string, readonly string[]>> =
  MEMBERS_COVERAGE_ALIASES;

/**
 * Per-canonical guard: alias values that must NOT be projected even though
 * they are non-blank. `product` on legacy contacts often holds a coverage
 * TYPE ("Health Sharing" / "Health Insurance") rather than a plan name;
 * surfacing that as the list's Plan column would be wrong. Shared with the
 * detail page's projection.
 */
export const MEMBERS_COVERAGE_ALIAS_REJECTS: Readonly<
  Record<string, (value: unknown) => boolean>
> = LEGACY_ALIAS_REJECTS_BY_MODULE.members ?? {};

/**
 * Fill blank members coverage columns from their same-meaning aliases.
 * Blank-fill only — a value a rep typed into `plan_name` is never replaced —
 * and returns a new object. Alias values rejected by
 * `MEMBERS_COVERAGE_ALIAS_REJECTS` are skipped (the next alias is tried).
 */
export function projectMembersCoverageAliases(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...data };
  for (const [canonical, aliases] of Object.entries(MEMBERS_COVERAGE_LIST_ALIASES)) {
    if (!isBlank(out[canonical])) continue;
    const reject = MEMBERS_COVERAGE_ALIAS_REJECTS[canonical];
    for (const alias of aliases) {
      const value = out[alias];
      if (isBlank(value)) continue;
      if (reject?.(value)) continue;
      out[canonical] = value;
      break;
    }
  }
  return out;
}
