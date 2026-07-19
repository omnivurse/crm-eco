import { CRM_DATA_JSONB_KEYS_SYNCED_TO_ROW_ON_PATCH } from '@/lib/crm/record-form-defaults';
import {
  CRM_RECORD_DATE_COLUMN_KEYS,
  CRM_RECORD_UUID_COLUMN_KEYS,
} from '@/lib/crm/record-field-registry';
import {
  HEALTH_SHARING_DATA_KEYS,
  leadHasHealthSharingData,
  sharingEntityAsCarrierId,
} from '@/lib/crm/lead-contact-sharing-fields';
import {
  HEALTH_INSURANCE_CARRIER_KEYS,
  healthInsuranceCarrierAsCarrierId,
  leadHasHealthInsuranceData,
} from '@/lib/crm/health-insurance-fields';

export interface MergeCrmDataJsonContext {
  /** For PATCH: previous row title when first/last clear. */
  previousTitle?: string | null;
  /**
   * `crm_modules.key` for the record. When `'contacts'`, `lead_status` in
   * JSONB is treated as historical (converted leads) and must not drive
   * `crm_records.status` — only `contact_status` / explicit `data.status`
   * do. The same applies to the **members** module (it uses `contact_status`
   * for operational status, not `lead_status`).
   */
  moduleKey?: string | null;
}

/**
 * The indexed columns these keys map to are typed (UUID, DATE, enum,
 * boolean). Postgres rejects empty strings for those types with
 * `invalid input syntax for type …`, so any blank-like value coming
 * out of the form must land as `null` instead. Text columns are
 * included too — `""` and `null` are equivalent there and coercing
 * yields cleaner reads downstream.
 */
export function normalizeRowColumnValue(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') {
      return null;
    }
    return value;
  }
  return value;
}

/**
 * Indexed `crm_records` columns that hold DATE values. Any value flowing into
 * one of these columns must be ISO-formatted (`YYYY-MM-DD`) with a sensible
 * 4-digit year, otherwise Postgres parses ambiguous strings like `"6/1/26"`
 * as June 1, year 26 AD — the historic 2-digit-year bug we healed in migration
 * 202605060006.
 */
const DATE_COLUMN_KEYS = CRM_RECORD_DATE_COLUMN_KEYS;

/**
 * Row columns typed as UUID in Postgres. Non-UUID free-text values must
 * NOT be synced here or Postgres returns `invalid input syntax for type uuid`.
 */
const UUID_COLUMN_KEYS = CRM_RECORD_UUID_COLUMN_KEYS;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Modules whose record display-name (`crm_records.title`) is derived from the
 * person's name fields (preferred / first / last). For these, the JSONB `title`
 * field is a **job title** (e.g. "Minister", "Outside Sales", "HR Director"),
 * NOT the display name — syncing it onto the `title` column made the job title
 * appear in the record heading instead of the person's name (the regression
 * this guard fixes). Entity modules (accounts → account_name, deals →
 * member_name, custom modules → title/name) are intentionally excluded so their
 * JSONB display name still flows through.
 */
const PERSON_DISPLAY_NAME_MODULE_KEYS = new Set([
  'contacts',
  'leads',
  'members',
  'prospects',
]);

function isPersonDisplayNameModule(moduleKey?: string | null): boolean {
  return (
    typeof moduleKey === 'string' &&
    PERSON_DISPLAY_NAME_MODULE_KEYS.has(moduleKey.toLowerCase())
  );
}

/** JSONB keys that store calendar dates (DOB, spouse/child DOBs, *_date fields). */
const CRM_JSONB_DATE_FIELD_KEY_RE = /(?:^date_of_birth$|_date$|_dob$)/i;

function isUuidValue(value: unknown): boolean {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function isCrmJsonbDateFieldKey(key: string): boolean {
  return CRM_JSONB_DATE_FIELD_KEY_RE.test(key);
}

/** True when month/day form a real calendar date (rejects 01/00, 0000-00-00, etc.). */
function isValidCalendarDateParts(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const probe = new Date(year, month - 1, day);
  return (
    probe.getFullYear() === year &&
    probe.getMonth() === month - 1 &&
    probe.getDate() === day
  );
}

/**
 * Normalize date-like keys in a JSONB patch before merge/save.
 * Blank, sentinel, and invalid legacy values (e.g. `01/00/2000`) become `null`
 * so reps can clear DOB and still save the rest of the lead.
 */
export function sanitizeCrmDataJsonPatch(
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    out[key] = isCrmJsonbDateFieldKey(key)
      ? normalizeDateColumnValue(value)
      : value;
  }
  return out;
}

/**
 * Normalise a user-supplied date string into ISO `YYYY-MM-DD`, applying a
 * Y2K-style pivot to 2-digit years. Returns null for blank values and the
 * trimmed input unchanged for already-ISO strings; throws-via-null for
 * uninterpretable strings (the caller decides whether to drop or surface).
 *
 *   "2026-06-01" → "2026-06-01"   (already ISO; passthrough)
 *   "6/1/2026"   → "2026-06-01"   (US 4-digit MDY)
 *   "6/1/26"     → "2026-06-01"   (2-digit pivot: 0..29 → +2000)
 *   "1/1/68"     → "1968-01-01"   (2-digit pivot: 30..99 → +1900)
 *   ""           → null
 *   "null"       → null
 *   "garbage"    → null
 */
export function normalizeDateColumnValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    const y = value.getUTCFullYear().toString().padStart(4, '0');
    const m = (value.getUTCMonth() + 1).toString().padStart(2, '0');
    const d = value.getUTCDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (
    trimmed === '' ||
    trimmed.toLowerCase() === 'null' ||
    trimmed.toLowerCase() === 'undefined' ||
    trimmed === '0000-00-00' ||
    trimmed === '00/00/0000' ||
    trimmed === '0/0/0000'
  ) {
    return null;
  }

  // Already-ISO with 4-digit year: validate and passthrough (only the date
  // portion — strip any T-suffix to keep DATE columns happy).
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    let yr = Number(isoMatch[1]);
    // Only zero-padded *legacy import* years (0026, 0068) get the Y2K pivot.
    // Full years like 1965 must pass through unchanged — applying the pivot to
    // every ISO year made typed DOB entry snap to 2000+ mid-edit.
    if (yr < 100) {
      if (yr >= 0 && yr <= 29) yr = 2000 + yr;
      else if (yr >= 30 && yr <= 99) yr = 1900 + yr;
    }
    if (yr < 1900 || yr > 2100) return null;
    if (!isValidCalendarDateParts(yr, month, day)) return null;
    return `${yr.toString().padStart(4, '0')}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // M/D/YYYY or M/D/YY (US-format) — the format historically present in CSVs.
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (slashMatch) {
    const [, mm, dd, yPart] = slashMatch;
    const month = Number(mm);
    const day = Number(dd);
    let year: number;
    if (yPart.length === 4) {
      year = Number(yPart);
      if (year < 1900 || year > 2100) return null;
    } else {
      const twoDigit = Number(yPart);
      year = twoDigit <= 29 ? 2000 + twoDigit : 1900 + twoDigit;
    }
    if (!isValidCalendarDateParts(year, month, day)) return null;
    return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  }

  return null;
}

/**
 * The single entry point EVERY `crm_records` write path should use so JSONB
 * `data` and the indexed row columns never drift apart. It:
 *   1. Sanitizes date-like JSONB keys (Zoho "6/1/26" → "2026-06-01", strips
 *      sentinels), returning the cleaned object to store in `data`.
 *   2. Mirrors canonical values onto their indexed columns (email, phone,
 *      title, status, market_type, carrier_id, *_date, group_name, advisor_id,
 *      normalized_* …) so lists, filters, RPCs, and reports see them.
 *
 * Callers spread `columns` onto the insert/update, then apply any authoritative
 * overrides of their own AFTER the spread (e.g. owner_id, created_by, or a
 * status/title the endpoint owns). This mirrors exactly what
 * `record-create-service` and `record-patch-service` already do — use this
 * everywhere else (clone, imports, webforms, webhooks, bulk) instead of
 * hand-rolling a partial column set, which strands data in JSONB only.
 *
 * Pure and side-effect free; does not read or write the database.
 */
export function buildNormalizedRecordWrite(
  data: Record<string, unknown> | null | undefined,
  ctx: MergeCrmDataJsonContext = {},
): { data: Record<string, unknown>; columns: Record<string, unknown> } {
  const source = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  const cleanData = sanitizeCrmDataJsonPatch(source);
  const columns = mergeCrmDataJsonIntoRowColumns(cleanData, ctx);
  return { data: cleanData, columns };
}

/**
 * Columns an UPDATE path must NOT re-mirror from (possibly stale) JSONB, because
 * a *separate* writer owns them:
 *   - `status` / `stage` — set explicitly by the endpoint / transition API.
 *   - the owner-assignment + normalization attribution columns — set as
 *     COLUMNS ONLY (not JSONB) by owner reassignment (single + bulk PATCH) and
 *     the normalization job.
 * A record's JSONB can legitimately hold stale copies of these (e.g. a full-form
 * edit persists the row-column mirror back into `data`). Re-mirroring them on an
 * UNRELATED field update would silently revert the out-of-band column change —
 * e.g. an inbound webhook reverting a manager's advisor reassignment. Creates are
 * unaffected (nothing is out-of-band yet); only updates strip these.
 */
export const CRM_UPDATE_MIRROR_EXCLUDE_KEYS: readonly string[] = [
  'status',
  'stage',
  'normalization_status',
  'canonical_advisor_id',
  'normalized_advisor_name',
  'normalized_agent_name',
  'advisor_id',
];

/**
 * Filter a mirrored-columns object down to the subset that is safe to write on
 * an UPDATE (see {@link CRM_UPDATE_MIRROR_EXCLUDE_KEYS}). `extraExclude` lets a
 * caller drop additional keys it owns authoritatively (e.g. the CSV-update path
 * owns title/email/phone via its own diff).
 */
export function pickUpdateMirrorColumns(
  columns: Record<string, unknown>,
  extraExclude: readonly string[] = [],
  /**
   * Keys that this PATCH intentionally owns (e.g. `status` when the client
   * sent `lead_status` / `contact_status` / `status` in `data`). Excluded
   * columns in this set are still written.
   */
  allowKeys: readonly string[] = [],
): Record<string, unknown> {
  const exclude = new Set<string>([...CRM_UPDATE_MIRROR_EXCLUDE_KEYS, ...extraExclude]);
  const allow = new Set<string>(allowKeys);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(columns)) {
    if (exclude.has(key) && !allow.has(key)) continue;
    out[key] = value;
  }
  return out;
}

/**
 * Maps JSONB `data` onto indexed `crm_records` columns (shared by POST and PATCH).
 */
export function mergeCrmDataJsonIntoRowColumns(
  d: Record<string, unknown>,
  ctx: MergeCrmDataJsonContext = {}
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};

  if (d.email !== undefined) updates.email = d.email || null;
  if (d.phone !== undefined) updates.phone = d.phone || null;

  // Title prefers `preferred_name` (nickname / commonly-used name) over the
  // legal `first_name`. Legal first_name is preserved on the record for
  // enrollment / carrier compliance, but the displayed title surfaces what
  // the contact actually goes by.
  if (
    d.first_name !== undefined ||
    d.last_name !== undefined ||
    d.preferred_name !== undefined
  ) {
    const preferred = (d.preferred_name as string) || '';
    const first = (d.first_name as string) || '';
    const last = (d.last_name as string) || '';
    const displayFirst = preferred || first;
    updates.title =
      ([displayFirst, last].filter(Boolean).join(' ') || ctx.previousTitle) ?? null;
  }

  // Status: for **leads** (and other non-person modules), lead_status → row,
  // then contact_status overrides, then explicit `data.status`. For **contacts**
  // and **members**, never map legacy `lead_status` onto the row — converted
  // rows often keep `lead_status: "Converted"` as history while the live field
  // is `contact_status`. Partial PATCHes merge into existing JSONB; without
  // this guard, `lead_status` could still drive the row when `contact_status`
  // was omitted from a patch payload.
  const personContactStyleModule =
    ctx.moduleKey === 'contacts' || ctx.moduleKey === 'members';
  if (!personContactStyleModule) {
    // Leads/deals/etc.: lead_status wins over stale contact_status so converted
    // leads are not re-opened to "In Process" on partial saves.
    if (d.lead_status !== undefined) {
      updates.status = d.lead_status || null;
    } else if (d.contact_status !== undefined) {
      updates.status = d.contact_status || null;
    }
  } else if (d.contact_status !== undefined) {
    updates.status = d.contact_status || null;
  }
  if (d.status !== undefined) updates.status = d.status || null;

  for (const key of CRM_DATA_JSONB_KEYS_SYNCED_TO_ROW_ON_PATCH) {
    if (d[key] !== undefined) {
      if (DATE_COLUMN_KEYS.has(key)) {
        updates[key] = normalizeDateColumnValue(d[key]);
      } else if (UUID_COLUMN_KEYS.has(key)) {
        // UUID row columns reject non-UUID strings with "invalid input
        // syntax for type uuid". Free-text values (e.g. "LifeX Co Pay PPO")
        // from carrier picker fallbacks live safely in JSONB and must NOT
        // be synced to the row column.
        const v = normalizeRowColumnValue(d[key]);
        updates[key] = v === null || isUuidValue(v) ? v : null;
      } else {
        updates[key] = normalizeRowColumnValue(d[key]);
      }
    }
  }

  // Legacy insurance-section `start_date` lives in JSONB only; mirror it to
  // `original_start_date` so the daily pending→active cron can find it.
  if (d.start_date !== undefined && d.original_start_date === undefined) {
    const mirrored = normalizeDateColumnValue(d.start_date);
    if (mirrored) {
      updates.original_start_date = mirrored;
      if (d.current_year_start_date === undefined) {
        updates.current_year_start_date = mirrored;
      }
    }
  }

  if (
    d.health_insurance_start_date !== undefined &&
    d.original_start_date === undefined &&
    updates.original_start_date === undefined
  ) {
    const mirrored = normalizeDateColumnValue(d.health_insurance_start_date);
    if (mirrored) {
      updates.original_start_date = mirrored;
      if (d.current_year_start_date === undefined && updates.current_year_start_date === undefined) {
        updates.current_year_start_date = mirrored;
      }
    }
  }

  // Entity / custom modules (deals, accounts, …): the display name lives in the
  // JSONB `title` / `name` field, so mirror it onto the `title` column.
  //
  // PERSON modules (contacts, leads, members, prospects) are skipped here: their
  // title is name-derived above, and their JSONB `title` field is a *job title*
  // (e.g. "Minister") that must never clobber the display name. The
  // `updates.title === undefined` guard is belt-and-suspenders — if the name
  // block above already produced a title, a stray `data.title` can't override it
  // even for callers that omit `moduleKey`.
  if (!isPersonDisplayNameModule(ctx.moduleKey)) {
    if (d.title !== undefined && updates.title === undefined) {
      updates.title = ((d.title as string) || ctx.previousTitle) ?? null;
    }
    if (d.name !== undefined && updates.title === undefined) {
      updates.title = ((d.name as string) || ctx.previousTitle) ?? null;
    }
  }

  const sharingTouched = HEALTH_SHARING_DATA_KEYS.some((key) => d[key] !== undefined);
  if (sharingTouched && leadHasHealthSharingData(d)) {
    const carrierFromSharing = sharingEntityAsCarrierId(d.sharing_entity);
    if (
      carrierFromSharing &&
      (updates.carrier_id === undefined || updates.carrier_id === null)
    ) {
      updates.carrier_id = carrierFromSharing;
    }
    if (updates.market_type === undefined || updates.market_type === null) {
      updates.market_type = 'healthshare';
    }
    if (d.sharing_effective_date !== undefined && updates.original_start_date === undefined) {
      const mirrored = normalizeDateColumnValue(d.sharing_effective_date);
      if (mirrored) {
        updates.original_start_date = mirrored;
        if (updates.current_year_start_date === undefined) {
          updates.current_year_start_date = mirrored;
        }
      }
    }
  }

  const insuranceCarrierTouched = HEALTH_INSURANCE_CARRIER_KEYS.some(
    (key) => d[key] !== undefined,
  );
  const insuranceTouched =
    insuranceCarrierTouched ||
    [
      'health_insurance_plan_name',
      'health_insurance_premium',
      'health_insurance_start_date',
      'health_insurance_end_date',
      'health_insurance_status',
      'health_insurance_deductible',
      'health_insurance_max_out_of_pocket',
    ].some((key) => d[key] !== undefined);

  if (insuranceTouched && leadHasHealthInsuranceData(d)) {
    let carrierFromInsurance: string | null = null;
    for (const key of HEALTH_INSURANCE_CARRIER_KEYS) {
      carrierFromInsurance = healthInsuranceCarrierAsCarrierId(d[key]);
      if (carrierFromInsurance) break;
    }
    if (
      carrierFromInsurance &&
      (updates.carrier_id === undefined || updates.carrier_id === null)
    ) {
      updates.carrier_id = carrierFromInsurance;
    }
    // Must match chk_crm_records_market_type:
    // healthshare | traditional_insurance | unknown (not form-section key "health_insurance").
    if (updates.market_type === undefined || updates.market_type === null) {
      updates.market_type = 'traditional_insurance';
    }
    if (
      d.health_insurance_start_date !== undefined &&
      updates.original_start_date === undefined
    ) {
      const mirrored = normalizeDateColumnValue(d.health_insurance_start_date);
      if (mirrored) {
        updates.original_start_date = mirrored;
        if (updates.current_year_start_date === undefined) {
          updates.current_year_start_date = mirrored;
        }
      }
    }
  }

  // Mirror end / termination dates into indexed cancellation_date so the
  // daily scheduled-cancellation cron can find them (same pattern as start dates).
  if (d.end_date !== undefined && d.cancellation_date === undefined) {
    const mirrored = normalizeDateColumnValue(d.end_date);
    if (mirrored) updates.cancellation_date = mirrored;
  }
  if (d.termination_date !== undefined && updates.cancellation_date === undefined) {
    const mirrored = normalizeDateColumnValue(d.termination_date);
    if (mirrored) updates.cancellation_date = mirrored;
  }
  if (d.coverage_end_date !== undefined && updates.cancellation_date === undefined) {
    const mirrored = normalizeDateColumnValue(d.coverage_end_date);
    if (mirrored) updates.cancellation_date = mirrored;
  }
  if (d.insurance_end_date !== undefined && updates.cancellation_date === undefined) {
    const mirrored = normalizeDateColumnValue(d.insurance_end_date);
    if (mirrored) updates.cancellation_date = mirrored;
  }
  if (d.sharing_end_date !== undefined && updates.cancellation_date === undefined) {
    const mirrored = normalizeDateColumnValue(d.sharing_end_date);
    if (mirrored) updates.cancellation_date = mirrored;
  }
  // health_insurance_end_date stays in JSONB only — it is the canonical major-medical
  // end date and must not overwrite the indexed membership cancellation_date.

  return updates;
}
