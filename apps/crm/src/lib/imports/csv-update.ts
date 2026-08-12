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
 * Kept dependency-free so the same code is callable from a Route Handler,
 * a unit test, or a background worker without dragging in `react`/`next`.
 */
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

/** Split a CSV blob into lines with CRLF / LF / CR support. */
function splitLines(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
}

/**
 * Parse a CSV blob to `ParsedCsv`. Empty lines and rows with only commas are
 * dropped. Throws if the file has no header row or no data rows.
 */
export function parseCsv(text: string): ParsedCsv {
  const lines = splitLines(text).filter((l) => l.trim().length > 0);
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
 */
export function normalizeDobForMatch(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s || s === '0000-00-00') return null;

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) {
    return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  }

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`;
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

export interface UpdatePayload {
  /** First-class column updates (only non-empty values). */
  columns: Partial<
    Pick<CrmRecord, 'title' | 'email' | 'phone' | 'status' | 'stage'>
  >;
  /** Merged JSONB to write back to `data`. */
  mergedData: Record<string, unknown>;
  /** Field-level diff (existing → new) for audit / preview. */
  delta: Record<string, { from: unknown; to: unknown }>;
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
  const existingData = (record.data || {}) as Record<string, unknown>;
  const mergedData: Record<string, unknown> = { ...existingData };

  for (const [key, rawValue] of Object.entries(row.normalized)) {
    const value = rawValue.trim();
    if (!overwriteEmpty && value.length === 0) continue;

    if (STANDARD_COLUMNS.has(key)) {
      const existing = (record as Record<string, unknown>)[key];
      if (existing !== value) {
        (columns as Record<string, unknown>)[key] = value;
        delta[key] = { from: existing ?? null, to: value };
      }
      // Mirror into JSONB so module fields backed by `data->>x` stay aligned.
      if (existingData[key] !== value) {
        mergedData[key] = value;
      }
    } else {
      const existing = existingData[key];
      if (existing !== value) {
        mergedData[key] = value;
        delta[key] = { from: existing ?? null, to: value };
      }
    }
  }

  return { columns, mergedData, delta };
}

// ---------------------------------------------------------------------------
// Limits / safety
// ---------------------------------------------------------------------------

/** Max rows accepted in a single request. Larger files should chunk client-side. */
export const MAX_CSV_ROWS = 10_000;
/** Max raw CSV size in bytes (≈ 8 MB worth of typical Zoho export). */
export const MAX_CSV_BYTES = 8 * 1024 * 1024;
