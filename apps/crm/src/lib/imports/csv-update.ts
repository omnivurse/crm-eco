/**
 * CSV-update import library
 * ----------------------------------------------------------------------------
 * Pure functions used by `/api/crm/imports/update` to:
 *
 *   1. Parse a CSV file (handles quoted fields, embedded commas, CRLF)
 *   2. Normalize header → DB-field aliases (zoho_id, email, phone…)
 *   3. Resolve each row to an existing CRM record by zoho_id → email → phone
 *   4. Build a partial update payload that only touches non-empty CSV cells
 *      (so a blank column in the export does not wipe an existing value)
 *
 * Kept free of react/next/supabase so the same code is callable from a Route
 * Handler, a unit test, or a background worker. The only runtime import is the
 * pure date/JSONB normalizer shared with every other `crm_records` write path —
 * diffing MUST use the same normalization as writing, or formatting drift
 * ("6/1/2026" vs "2026-06-01", "$450" vs 450) reports as a change every month
 * and overwrites stored values with the CSV's raw string.
 */
import {
  isCrmJsonbDateFieldKey,
  normalizeDateColumnValue,
} from '@/lib/crm/merge-crm-data-json-to-row';
import type { CrmRecord } from '@/lib/crm/types';

/** Standard CrmRecord columns that get written to first-class columns
 *  (everything else lands inside `data` JSONB). */
const STANDARD_COLUMNS = new Set([
  'title',
  'email',
  'phone',
  'status',
  'stage',
]);

/** CSV header → canonical field key. Anything not listed falls through as
 *  the lowercased/snake_cased version of the raw header. */
const HEADER_ALIASES: Record<string, string> = {
  // Identity
  'zoho id': 'zoho_id',
  'zoho_id': 'zoho_id',
  'record id': 'zoho_id',
  'record_id': 'zoho_id',
  // Names
  'first name': 'first_name',
  'firstname': 'first_name',
  'last name': 'last_name',
  'lastname': 'last_name',
  'full name': 'title',
  'name': 'title',
  // Contact
  'email': 'email',
  'email address': 'email',
  'e-mail': 'email',
  'phone': 'phone',
  'phone number': 'phone',
  'phone belongs to': 'phone_owner',
  'phone owner name': 'phone_owner_name',
  'mobile': 'mobile',
  'mobile phone': 'mobile',
  'cell': 'mobile',
  'mobile belongs to': 'mobile_owner',
  'mobile owner name': 'mobile_owner_name',
  'work phone': 'work_phone',
  'work phone belongs to': 'work_phone_owner',
  'home phone': 'home_phone',
  'phone 2': 'phone2',
  'phone 2 belongs to': 'phone2_owner',
  'phone 2 owner name': 'phone2_owner_name',
  'mobile 2': 'mobile_2',
  'mobile 2 belongs to': 'mobile_2_owner',
  'mobile 2 owner name': 'mobile_2_owner_name',
  // Status / lifecycle
  'status': 'status',
  'lead status': 'lead_status',
  'contact status': 'contact_status',
  'stage': 'stage',
  // Identity for name+DOB match
  'date of birth': 'date_of_birth',
  'date_of_birth': 'date_of_birth',
  'dob': 'date_of_birth',
  'birthday': 'date_of_birth',
  // Address
  'street': 'mailing_street',
  'address': 'mailing_street',
  'city': 'mailing_city',
  'state': 'mailing_state',
  'zip': 'mailing_zip',
  'zip code': 'mailing_zip',
  'postal code': 'mailing_zip',
  'county': 'county',
  'country': 'mailing_country',
};

export type MatchKey = 'zoho_id' | 'email' | 'phone' | 'name_dob';

/** Canonical match order for Entity Reupload (trickle update). */
export const DEFAULT_MATCH_PRIORITY: MatchKey[] = [
  'zoho_id',
  'email',
  'phone',
  'name_dob',
];

export interface UpdateRow {
  /** 0-based index in the original CSV (after header row) */
  index: number;
  /** Raw row keyed by original CSV header (untouched) */
  raw: Record<string, string>;
  /** Row keyed by canonical (snake_case / aliased) field key, blanks stripped */
  normalized: Record<string, string>;
  /** Matching keys extracted from the row */
  keys: {
    zoho_id?: string;
    email?: string;
    phone?: string;
    /** `first|last|YYYY-MM-DD` when all three are present */
    name_dob?: string;
  };
}

export interface ParsedCsv {
  headers: string[];
  rows: UpdateRow[];
}

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

/**
 * Parse a single CSV line that may contain quoted fields with embedded commas
 * or escaped quotes (`""`). Mirrors the lightweight parser used elsewhere in
 * the codebase so we don't pull in Papa Parse for one route.
 */
export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // Escaped quote ("") inside a quoted field
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  result.push(current);

  // Trim outer whitespace but preserve interior spaces (e.g., addresses).
  return result.map((s) => s.trim());
}

/**
 * Split a CSV blob into logical records, honoring quoted fields that span
 * newlines (Zoho Street / Description columns routinely do). A naive
 * split-on-newline truncates the quoted value AND turns the continuation
 * into a spurious extra row whose cells land under the wrong headers —
 * which can put a valid-looking match key under the wrong column and update
 * a record with garbage. Throws on an unterminated quote instead of
 * guessing.
 */
function splitCsvRecords(text: string): string[] {
  const records: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '""';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      current += ch;
      continue;
    }
    if (!inQuotes && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      records.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (inQuotes) {
    throw new Error(
      'Unterminated quoted field — the file is not a valid CSV export. ' +
        'Re-export it rather than editing by hand.',
    );
  }
  records.push(current);
  return records;
}

/**
 * Parse a CSV blob to `ParsedCsv`. Empty lines and rows with only commas are
 * dropped. Throws if the file has no header row or no data rows.
 */
export function parseCsv(text: string): ParsedCsv {
  const lines = splitCsvRecords(text).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('CSV must include a header row and at least one data row');
  }

  const headers = parseCsvLine(lines[0]);
  if (headers.length === 0) {
    throw new Error('CSV header row is empty');
  }

  const rows: UpdateRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const raw: Record<string, string> = {};
    const normalized: Record<string, string> = {};
    headers.forEach((header, idx) => {
      const value = values[idx] ?? '';
      raw[header] = value;
      const key = canonicalizeHeader(header);
      if (value.length > 0 && key) {
        normalized[key] = value;
      }
    });

    rows.push({
      index: i - 1,
      raw,
      normalized,
      keys: extractMatchKeys(normalized),
    });
  }

  return { headers, rows };
}

// ---------------------------------------------------------------------------
// Field name normalization
// ---------------------------------------------------------------------------

/**
 * Map a CSV header to a canonical field key. Returns `null` for genuinely
 * empty header cells; otherwise returns either an alias hit or the raw
 * header lowercased + snake-cased.
 */
export function canonicalizeHeader(header: string): string | null {
  const trimmed = header.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (HEADER_ALIASES[lower]) return HEADER_ALIASES[lower];
  return lower
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Normalize a date-of-birth value to `YYYY-MM-DD` for match comparison.
 * Returns null when empty/unparseable — those rows never match on name+DOB.
 *
 * Delegates to the shared write-path normalizer so match keys and stored
 * values use the same rules (2-digit-year pivot, sentinel + calendar
 * validation). The old `new Date(s)` fallback is gone: it parsed in the
 * server's LOCAL timezone and used V8's own century pivot, silently producing
 * off-by-one-day or wrong-century keys for formats like "6/1/80".
 */
export function normalizeDobForMatch(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;
  return normalizeDateColumnValue(s);
}

/**
 * Stable identity key from first + last + DOB. Null unless all three present.
 */
export function nameDobKey(
  first: unknown,
  last: unknown,
  dob: unknown,
): string | null {
  const f = String(first ?? '')
    .trim()
    .toLowerCase();
  const l = String(last ?? '')
    .trim()
    .toLowerCase();
  const d = normalizeDobForMatch(dob);
  if (!f || !l || !d) return null;
  return `${f}|${l}|${d}`;
}

/** Pull match keys out of a normalized row. Phones are digit-only. */
export function extractMatchKeys(
  normalized: Record<string, string>,
): UpdateRow['keys'] {
  const keys: UpdateRow['keys'] = {};
  if (normalized.zoho_id) keys.zoho_id = normalized.zoho_id.trim();
  if (normalized.email) keys.email = normalized.email.trim().toLowerCase();
  // Prefer `phone`; fall back to `mobile` / `cell` aliases.
  const rawPhone =
    normalized.phone || normalized.mobile || normalized.cell || '';
  if (rawPhone) {
    const digits = rawPhone.replace(/\D/g, '');
    if (digits.length >= 7 && digits.length <= 15) {
      keys.phone = digits;
    }
  }
  const nd = nameDobKey(
    normalized.first_name,
    normalized.last_name,
    normalized.date_of_birth,
  );
  if (nd) keys.name_dob = nd;
  return keys;
}

/**
 * Keep only the highest-priority match key present on the row.
 * Used so each row participates in exactly one lookup bucket.
 */
export function filterKeysByPriority(
  keys: UpdateRow['keys'],
  matchPriority: MatchKey[],
): UpdateRow['keys'] {
  const filtered: UpdateRow['keys'] = {};
  for (const slot of matchPriority) {
    if (keys[slot]) {
      filtered[slot] = keys[slot];
      break;
    }
  }
  return filtered;
}

// ---------------------------------------------------------------------------
// Match planning
// ---------------------------------------------------------------------------

export interface MatchPlan {
  /** Zoho-ID values to look up exactly (case-sensitive). */
  zohoIds: string[];
  /** Lowercase emails to look up. */
  emails: string[];
  /** Digit-only phones to look up via crm_phone_lookup RPC. */
  phones: string[];
  /** `first|last|YYYY-MM-DD` keys. */
  nameDobs: string[];
  /** Index of rows by each key for fast back-lookup after the DB query. */
  byZohoId: Map<string, UpdateRow[]>;
  byEmail: Map<string, UpdateRow[]>;
  byPhone: Map<string, UpdateRow[]>;
  byNameDob: Map<string, UpdateRow[]>;
}

/** Bucket rows by their match keys for batch DB queries. */
export function planMatches(rows: UpdateRow[]): MatchPlan {
  const byZohoId = new Map<string, UpdateRow[]>();
  const byEmail = new Map<string, UpdateRow[]>();
  const byPhone = new Map<string, UpdateRow[]>();
  const byNameDob = new Map<string, UpdateRow[]>();

  for (const row of rows) {
    if (row.keys.zoho_id) {
      pushTo(byZohoId, row.keys.zoho_id, row);
    } else if (row.keys.email) {
      pushTo(byEmail, row.keys.email, row);
    } else if (row.keys.phone) {
      pushTo(byPhone, row.keys.phone, row);
    } else if (row.keys.name_dob) {
      pushTo(byNameDob, row.keys.name_dob, row);
    }
  }

  return {
    zohoIds: Array.from(byZohoId.keys()),
    emails: Array.from(byEmail.keys()),
    phones: Array.from(byPhone.keys()),
    nameDobs: Array.from(byNameDob.keys()),
    byZohoId,
    byEmail,
    byPhone,
    byNameDob,
  };
}

function pushTo<V>(map: Map<string, V[]>, key: string, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

// ---------------------------------------------------------------------------
// Update payload construction
// ---------------------------------------------------------------------------

/**
 * Keys a CSV update must NEVER write, no matter what the file contains.
 * Notes and authorship are owned by the CRM; identifiers and soft-delete
 * bookkeeping are owned by the database. A file carrying these columns is
 * either the wrong file or an export of internal state — ignore the cells.
 */
export const PROTECTED_UPDATE_KEYS: ReadonlySet<string> = new Set([
  'notes',
  'notes_history',
  'created_by',
  'created_at',
  'updated_at',
  'id',
  'org_id',
  'organization_id',
  'module_id',
  'owner_id',
  'deleted_at',
  'deleted_by',
  'deleted_origin',
  // Provenance / origin-tier bookkeeping: a re-uploaded CRM export must not
  // rewrite migration-wave labels, and identity keys must not drift via a
  // row that matched on a different key.
  'import_source',
  'source_record_id',
  'import_batch_id',
  'record_type',
  'zoho_id',
  // Exporter bookkeeping columns. These are metadata ABOUT the file, not
  // facts about the person: writing them would make every row of every
  // monthly export look "changed" even when no real field moved, which is
  // exactly the noise that makes a delta unreviewable. `modified_time` is
  // still READ off the row for the stale-export flag — this only stops it
  // being stored.
  'modified_time',
  'last_modified_time',
  'last_modified',
  'created_time',
  'last_activity_time',
]);

export interface UpdatePayload {
  /** First-class column updates (only non-empty values). */
  columns: Partial<
    Pick<CrmRecord, 'title' | 'email' | 'phone' | 'status' | 'stage'>
  >;
  /** Merged JSONB to write back to `data`. */
  mergedData: Record<string, unknown>;
  /** Field-level diff (existing → new) for audit / preview. */
  delta: Record<string, { from: unknown; to: unknown }>;
  /**
   * Keys whose CSV cell could not be applied faithfully (unparseable date,
   * non-numeric string over a stored number, non-boolean over a stored
   * boolean, scalar over an array/object) — skipped, never written.
   */
  invalidKeys: string[];
  /**
   * Keys actually modified inside `mergedData`. The writer sanitizes and
   * mirrors ONLY these — running the full merged blob through the write-path
   * normalizer silently nulled legacy values in keys the CSV never touched.
   */
  changedDataKeys: string[];
}

/** Resolution of one incoming CSV cell against the stored value. */
export type IncomingValueResolution =
  | { kind: 'skip-invalid' }
  | { kind: 'unchanged' }
  | { kind: 'set'; value: unknown };

function parseNumericString(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseBooleanString(value: string): boolean | null {
  const v = value.trim().toLowerCase();
  if (v === 'true' || v === 'yes' || v === 'y' || v === '1') return true;
  if (v === 'false' || v === 'no' || v === 'n' || v === '0') return false;
  return null;
}

/**
 * Compare an incoming CSV string against the stored JSONB value using the
 * same normalization the write path applies, so formatting drift is not a
 * "change":
 *
 *   - date-like keys: both sides through `normalizeDateColumnValue`; an
 *     unparseable CSV date is SKIPPED (never written) rather than clobbering
 *     a stored date with garbage
 *   - stored numbers: numeric-looking CSV strings ("$475.00", "1,200")
 *     compare and write as numbers, preserving the stored type
 *   - stored booleans: "Yes"/"No"/"true"/"1" compare and write as booleans
 *   - everything else: loose string equality (so number 450 vs "450" is not
 *     a change), CSV string written on a real difference
 */
export function resolveIncomingJsonValue(
  key: string,
  existing: unknown,
  csvValue: string,
): IncomingValueResolution {
  if (isCrmJsonbDateFieldKey(key)) {
    const normalized = normalizeDateColumnValue(csvValue);
    if (normalized === null) return { kind: 'skip-invalid' };
    const existingNorm =
      typeof existing === 'string' || existing instanceof Date
        ? normalizeDateColumnValue(existing)
        : null;
    if (existingNorm === normalized) return { kind: 'unchanged' };
    return { kind: 'set', value: normalized };
  }

  if (typeof existing === 'number') {
    const numeric = parseNumericString(csvValue);
    if (numeric === null) return { kind: 'skip-invalid' };
    return numeric === existing
      ? { kind: 'unchanged' }
      : { kind: 'set', value: numeric };
  }

  if (typeof existing === 'boolean') {
    const bool = parseBooleanString(csvValue);
    if (bool === null) return { kind: 'skip-invalid' };
    return bool === existing
      ? { kind: 'unchanged' }
      : { kind: 'set', value: bool };
  }

  // A scalar CSV cell must never replace a structured value (multiselect
  // arrays, nested objects) — there is no faithful string round-trip.
  if (typeof existing === 'object' && existing !== null) {
    return { kind: 'skip-invalid' };
  }

  if (existing === null || existing === undefined) {
    return { kind: 'set', value: csvValue };
  }
  return String(existing) === csvValue
    ? { kind: 'unchanged' }
    : { kind: 'set', value: csvValue };
}

/**
 * Build the patch we'd apply to a single record.
 *
 * Empty CSV cells are *never* written. This means a blank "Status" column in
 * the export does not clobber a status that was set in the new CRM. That's
 * the right default for "trickle in updates from Zoho while we migrate".
 *
 * If `overwriteEmpty` is true, blank cells *do* overwrite (caller opt-in).
 */
export function buildUpdatePayload(
  record: Pick<
    CrmRecord,
    'title' | 'email' | 'phone' | 'status' | 'stage' | 'data'
  >,
  row: UpdateRow,
  options: { overwriteEmpty?: boolean } = {},
): UpdatePayload {
  const { overwriteEmpty = false } = options;
  const columns: UpdatePayload['columns'] = {};
  const delta: UpdatePayload['delta'] = {};
  const invalidKeys: string[] = [];
  const changedDataKeys: string[] = [];
  const existingData = (record.data || {}) as Record<string, unknown>;
  const mergedData: Record<string, unknown> = { ...existingData };

  for (const [key, rawValue] of Object.entries(row.normalized)) {
    if (PROTECTED_UPDATE_KEYS.has(key)) continue;
    const value = rawValue.trim();
    if (!overwriteEmpty && value.length === 0) continue;

    if (STANDARD_COLUMNS.has(key)) {
      const existing = (record as Record<string, unknown>)[key];
      // Matching is case-insensitive for email, so a case-only difference is
      // not a change — rewriting the casing would bump updated_at and write
      // an audit row for thousands of otherwise-unchanged records.
      const differs =
        key === 'email' && typeof existing === 'string'
          ? existing.toLowerCase() !== value.toLowerCase()
          : existing !== value;
      if (differs) {
        (columns as Record<string, unknown>)[key] = value;
        delta[key] = { from: existing ?? null, to: value };
      }
      // Mirror into JSONB so module fields backed by `data->>x` stay aligned.
      const mirrorDiffers =
        key === 'email' && typeof existingData[key] === 'string'
          ? (existingData[key] as string).toLowerCase() !== value.toLowerCase()
          : existingData[key] !== value;
      if (mirrorDiffers) {
        mergedData[key] = value;
        changedDataKeys.push(key);
      }
    } else {
      const existing = existingData[key];
      const resolved = resolveIncomingJsonValue(key, existing, value);
      if (resolved.kind === 'skip-invalid') {
        invalidKeys.push(key);
        continue;
      }
      if (resolved.kind === 'set') {
        mergedData[key] = resolved.value;
        changedDataKeys.push(key);
        delta[key] = { from: existing ?? null, to: resolved.value };
      }
    }
  }

  return { columns, mergedData, delta, invalidKeys, changedDataKeys };
}

// ---------------------------------------------------------------------------
// Limits / safety
// ---------------------------------------------------------------------------

/** Max rows accepted in a single request. Larger files should chunk client-side. */
export const MAX_CSV_ROWS = 10_000;
/** Max raw CSV size in bytes (≈ 8 MB worth of typical Zoho export). */
export const MAX_CSV_BYTES = 8 * 1024 * 1024;
