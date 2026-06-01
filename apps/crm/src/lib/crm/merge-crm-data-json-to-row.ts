import { CRM_DATA_JSONB_KEYS_SYNCED_TO_ROW_ON_PATCH } from '@/lib/crm/record-form-defaults';

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
const DATE_COLUMN_KEYS = new Set([
  'original_start_date',
  'current_year_start_date',
  'cancellation_date',
]);

/**
 * Row columns typed as UUID in Postgres. Non-UUID free-text values must
 * NOT be synced here or Postgres returns `invalid input syntax for type uuid`.
 */
const UUID_COLUMN_KEYS = new Set([
  'carrier_id',
  'canonical_advisor_id',
  'advisor_id',
  'territory_id',
  'source_record_id',
  'import_batch_id',
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuidValue(value: unknown): boolean {
  return typeof value === 'string' && UUID_RE.test(value);
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
    trimmed === '0000-00-00'
  ) {
    return null;
  }

  // Already-ISO with 4-digit year: validate and passthrough (only the date
  // portion — strip any T-suffix to keep DATE columns happy).
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const yr = Number(isoMatch[1]);
    if (yr >= 1900 && yr <= 2100) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    if (yr >= 0 && yr <= 29) return `${(2000 + yr).toString().padStart(4, '0')}-${isoMatch[2]}-${isoMatch[3]}`;
    if (yr >= 30 && yr <= 99) return `${(1900 + yr).toString().padStart(4, '0')}-${isoMatch[2]}-${isoMatch[3]}`;
    return null;
  }

  // M/D/YYYY or M/D/YY (US-format) — the format historically present in CSVs.
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (slashMatch) {
    const [, mm, dd, yPart] = slashMatch;
    const month = mm.padStart(2, '0');
    const day = dd.padStart(2, '0');
    let year: number;
    if (yPart.length === 4) {
      year = Number(yPart);
      if (year < 1900 || year > 2100) return null;
    } else {
      const twoDigit = Number(yPart);
      year = twoDigit <= 29 ? 2000 + twoDigit : 1900 + twoDigit;
    }
    return `${year.toString().padStart(4, '0')}-${month}-${day}`;
  }

  return null;
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

  // Deals / accounts: display name only in JSONB
  if (d.title !== undefined) {
    updates.title = ((d.title as string) || ctx.previousTitle) ?? null;
  }
  if (d.name !== undefined && updates.title === undefined) {
    updates.title = ((d.name as string) || ctx.previousTitle) ?? null;
  }

  return updates;
}
