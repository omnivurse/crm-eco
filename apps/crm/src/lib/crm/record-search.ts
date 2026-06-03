/**
 * Shared text/phone search for `crm_records` list queries (server module page + REST API).
 *
 * PostgREST `.or()` filter strings **cannot** reliably use `data::text` (the `::`
 * collides with API parsing). We search JSONB with `data->>field_key.ilike...`
 * using each module's `crm_fields.key` list instead.
 *
 * Multi-word queries AND across terms: each word must match in at least one column
 * (chained `.or()` groups are AND'd).
 */

export function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&');
}

/** Minimal row shape needed to detect an already-converted lead. */
export interface ConvertedLeadCheck {
  module_key?: string | null;
  status?: string | null;
  data?: Record<string, unknown> | null;
}

/**
 * True when a search row is a Lead that has already been converted into a
 * Contact.
 *
 * Lead→contact conversion (the `convert_lead_to_contact` RPC) intentionally
 * KEEPS the original lead as an audit trail: it sets `status='Converted'`,
 * `data.is_converted=true`, `data.converted_contact_id`, `data.lead_status`,
 * and writes a `lead_to_contact` row into `crm_record_links`. The live record
 * a rep should act on after conversion is the new Contact, not the stale lead.
 *
 * Because both records share the same name/email/phone, surfacing the
 * converted lead alongside its contact makes a single person look like a
 * duplicate (the reported PIFH complaint — e.g. "Lindsay Taggart" appearing
 * twice). Hiding converted leads from search mirrors Zoho's default behavior;
 * the lead stays reachable from the contact's "converted from" link.
 *
 * Robust against partial markers: any one converted signal is enough, since
 * historical conversions don't all populate every field.
 */
export function isConvertedLeadRow(row: ConvertedLeadCheck): boolean {
  if ((row.module_key ?? '') !== 'leads') return false;
  if ((row.status ?? '') === 'Converted') return true;

  const data = row.data ?? {};
  const isConverted = data['is_converted'];
  if (isConverted === true || isConverted === 'true') return true;

  const convertedContactId = data['converted_contact_id'];
  if (typeof convertedContactId === 'string' && convertedContactId.trim().length > 0) {
    return true;
  }

  return data['lead_status'] === 'Converted';
}

/** Safe `data->>` path segment for PostgREST filter strings */
const SAFE_DATA_JSON_KEY = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Load field keys for a module so list search can target `data->>key` without casts.
 * Capped to keep `.or()` filter strings within PostgREST URL limits.
 */
export async function fetchModuleDataJsonKeysForSearch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  moduleId: string,
  maxKeys = 80,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('crm_fields')
    .select('key')
    .eq('module_id', moduleId);
  if (error || !data) return [];
  return (data as { key: string }[])
    .map((r) => r.key)
    .filter((k) => typeof k === 'string' && SAFE_DATA_JSON_KEY.test(k))
    .slice(0, maxKeys);
}

/**
 * Common JSON paths that store phone-like values (substring digit search).
 * Kept in sync with `/api/crm/search` phone fallbacks.
 */
const JSON_PHONE_FIELD_KEYS = [
  'mobile',
  'work_phone',
  'home_phone',
  'cell',
  'mobile_phone',
  'cell_phone',
  'phone_number',
  'alt_phone',
  'secondary_phone',
  'fax',
];

/**
 * Generate common visual phone formats for a digit string so ILIKE can match
 * differently formatted rows (same strategy as global search).
 */
export function phoneFormatVariants(digits: string): string[] {
  if (digits.length < 4) return [];

  const out = new Set<string>();
  const candidates: string[] = [digits];
  if (digits.length === 11 && digits.startsWith('1')) {
    candidates.push(digits.slice(1));
  } else if (digits.length === 10) {
    candidates.push('1' + digits);
  }

  for (const d of candidates) {
    out.add(d);
    if (d.length === 10) {
      const a = d.slice(0, 3);
      const b = d.slice(3, 6);
      const c = d.slice(6);
      out.add(`${a}-${b}-${c}`);
      out.add(`(${a}) ${b}-${c}`);
      out.add(`(${a})${b}-${c}`);
      out.add(`(${a}) ${b} ${c}`);
      out.add(`${a}.${b}.${c}`);
      out.add(`${a} ${b} ${c}`);
    } else if (d.length === 11 && d.startsWith('1')) {
      const a = d.slice(1, 4);
      const b = d.slice(4, 7);
      const c = d.slice(7);
      out.add(`1-${a}-${b}-${c}`);
      out.add(`1 (${a}) ${b}-${c}`);
      out.add(`+1 ${a} ${b}-${c}`);
      out.add(`+1-${a}-${b}-${c}`);
      out.add(`+1 (${a}) ${b}-${c}`);
    }
  }
  return Array.from(out);
}

const MAX_PHONE_OR_CLAUSES = 48;

function mergeJsonFieldKeys(dataJsonKeys?: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const k of [...JSON_PHONE_FIELD_KEYS, ...(dataJsonKeys ?? [])]) {
    if (!k || !SAFE_DATA_JSON_KEY.test(k) || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
    if (out.length >= 80) break;
  }
  return out;
}

function pushJsonDigitClauses(
  clauses: Set<string>,
  digits: string,
  tail: string | null,
  dataJsonKeys: string[] | undefined,
) {
  const keys = mergeJsonFieldKeys(dataJsonKeys);
  for (const key of keys) {
    if (clauses.size >= MAX_PHONE_OR_CLAUSES) break;
    clauses.add(`data->>${key}.ilike.%${escapeIlikePattern(digits)}%`);
    if (tail && tail !== digits && clauses.size < MAX_PHONE_OR_CLAUSES) {
      clauses.add(`data->>${key}.ilike.%${escapeIlikePattern(tail)}%`);
    }
  }
}

function buildWordSearchOrClause(
  pattern: string /** includes leading/trailing `%` */,
  dataJsonKeys: string[] | undefined,
): string {
  const parts = [`title.ilike.${pattern}`, `email.ilike.${pattern}`, `phone.ilike.${pattern}`];
  for (const key of mergeJsonFieldKeys(dataJsonKeys)) {
    parts.push(`data->>${key}.ilike.${pattern}`);
  }
  return parts.join(',');
}

/**
 * Single PostgREST `.or(...)` filter string for phone-heavy search on `crm_records`.
 */
export function buildPhoneSearchOrFilter(
  rawSearch: string,
  opts?: { dataJsonKeys?: string[] },
): string {
  const digits = rawSearch.replace(/\D/g, '');
  if (digits.length < 4 || digits.length > 15) {
    return '';
  }

  const safeRaw = escapeIlikePattern(rawSearch);
  const clauses = new Set<string>();

  clauses.add(`phone.ilike.%${escapeIlikePattern(digits)}%`);
  const tail = digits.slice(-10);
  if (tail && tail !== digits) {
    clauses.add(`phone.ilike.%${escapeIlikePattern(tail)}%`);
  }

  for (const v of phoneFormatVariants(digits)) {
    if (clauses.size >= MAX_PHONE_OR_CLAUSES) break;
    clauses.add(`phone.ilike.%${escapeIlikePattern(v)}%`);
  }

  clauses.add(`phone.ilike.%${safeRaw}%`);

  if (digits.length >= 4) {
    pushJsonDigitClauses(clauses, digits, tail !== digits ? tail : null, opts?.dataJsonKeys);
  }

  return Array.from(clauses).join(',');
}

type OrQuery = { or: (filters: string) => OrQuery };

export interface ApplyCrmRecordTextSearchOpts {
  /** Module `crm_fields.key` values — drives `data->>key` ILIKE clauses */
  dataJsonKeys?: string[];
}

/**
 * True when the user is clearly typing a phone (formatted digits), matching `/api/crm/search`.
 */
function isPhoneHeavyQuery(rawSearch: string): boolean {
  const phoneDigits = rawSearch.replace(/[^0-9]/g, '');
  const compactLen = Math.max(rawSearch.replace(/\s/g, '').length, 1);
  const digitRatio = phoneDigits.length / compactLen;
  return (
    phoneDigits.length >= 4 &&
    phoneDigits.length <= 15 &&
    digitRatio >= 0.88 &&
    !rawSearch.includes('@')
  );
}

/** Single token looks like a standalone phone fragment (digits + typical separators). */
function tokenLooksLikePhone(term: string): boolean {
  const digitsOnly = term.replace(/\D/g, '');
  if (digitsOnly.length < 4 || digitsOnly.length > 15 || term.includes('@')) return false;
  const compactLen = Math.max(term.replace(/\s/g, '').length, 1);
  const ratio = digitsOnly.length / compactLen;
  return ratio >= 0.8;
}

/**
 * Applies search filters to a PostgREST query builder that exposes `.or(...)`.
 */
export function applyCrmRecordTextSearch<Q extends OrQuery>(
  query: Q,
  search: string | undefined,
  opts?: ApplyCrmRecordTextSearchOpts,
): Q {
  if (!search || !search.trim()) return query;

  const rawSearch = search.trim();
  const dataJsonKeys = opts?.dataJsonKeys;

  if (isPhoneHeavyQuery(rawSearch)) {
    const phoneFilter = buildPhoneSearchOrFilter(rawSearch, { dataJsonKeys });
    if (phoneFilter) {
      return query.or(phoneFilter) as Q;
    }
  }

  const terms = rawSearch.split(/\s+/).filter(Boolean);
  let q: OrQuery = query;
  for (const term of terms) {
    if (tokenLooksLikePhone(term)) {
      const phoneFilter = buildPhoneSearchOrFilter(term, { dataJsonKeys });
      if (phoneFilter) {
        q = q.or(phoneFilter);
        continue;
      }
    }
    const p = `%${escapeIlikePattern(term)}%`;
    q = q.or(buildWordSearchOrClause(p, dataJsonKeys));
  }
  return q as Q;
}
