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

import { isConvertedLeadRow } from '@crm-eco/lib';

export {
  applyHideConvertedLeadsFilter,
  isConvertedLeadRow,
  type ConvertedLeadCheck,
} from '@crm-eco/lib';

export function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&');
}

/** Safe `data->>` path segment for PostgREST filter strings */
/**
 * A JSONB key safe to interpolate into a PostgREST `data->>key` filter path.
 * Exported so every site that builds such a path uses the same guard rather
 * than re-deriving (or forgetting) it.
 */
export const SAFE_DATA_JSON_KEY = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Load field keys for a module so list search can target `data->>key` without casts.
 * Capped to keep `.or()` filter strings within PostgREST URL limits.
 */
/**
 * Keys a rep is most likely to search a person by. Sorted to the front of the
 * capped set so they are ALWAYS searchable — before this, the cap sliced an
 * unordered query result, so which fields were searchable was arbitrary and
 * shifted whenever field definitions were added.
 */
const SEARCH_KEY_PRIORITY = [
  'first_name', 'last_name', 'middle_name', 'preferred_name', 'contact_name',
  'member_number', 'sharing_member_id', 'e123_member_id', 'internal_id',
  'email', 'email2', 'secondary_email',
  'mobile', 'phone2', 'work_phone', 'home_phone', 'cell',
  'city', 'state', 'zip_code', 'mailing_city', 'mailing_state', 'mailing_zip',
  'address_line1', 'mailing_street',
  'company', 'company_name',
  'sharing_entity', 'carrier', 'product', 'plan_name',
  'advisor_name', 'advisor_code', 'producer_name',
  'lead_status', 'contact_status',
];

const PRIORITY_RANK = new Map(SEARCH_KEY_PRIORITY.map((k, i) => [k, i]));

export async function fetchModuleDataJsonKeysForSearch(
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
    // Deterministic: high-value keys first, then alphabetical so the searched
    // set is stable across deploys instead of depending on row order.
    .sort((a, b) => {
      const ra = PRIORITY_RANK.get(a) ?? Number.MAX_SAFE_INTEGER;
      const rb = PRIORITY_RANK.get(b) ?? Number.MAX_SAFE_INTEGER;
      return ra !== rb ? ra - rb : a.localeCompare(b);
    })
    .slice(0, maxKeys);
}

/**
 * Field keys across all (or one) module(s) in an org — for global CRM search fallbacks.
 */
export async function fetchOrgDataJsonKeysForSearch(
  supabase: any,
  orgId: string,
  moduleKey: string | null = null,
  maxKeys = 120,
): Promise<string[]> {
  let moduleQuery = supabase.from('crm_modules').select('id').eq('org_id', orgId);
  if (moduleKey) {
    moduleQuery = moduleQuery.eq('key', moduleKey);
  }
  const { data: modules, error: moduleError } = await moduleQuery;
  if (moduleError || !modules?.length) return [];

  const moduleIds = (modules as { id: string }[]).map((m) => m.id);
  const { data: fields, error: fieldError } = await supabase
    .from('crm_fields')
    .select('key')
    .in('module_id', moduleIds);
  if (fieldError || !fields) return [];

  const seen = new Set<string>();
  const keys: string[] = [];
  for (const row of fields as { key: string }[]) {
    const k = row.key;
    if (!k || !SAFE_DATA_JSON_KEY.test(k) || seen.has(k)) continue;
    seen.add(k);
    keys.push(k);
    if (keys.length >= maxKeys) break;
  }
  return keys;
}

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

/** Fast path for global search fallbacks — avoids a modules+fields round trip. */
export const CORE_GLOBAL_SEARCH_JSON_KEYS = [
  'first_name',
  'last_name',
  // Identifiers reps look people up by. The global-search tsvector does not
  // cover these, so without them a member number finds nothing.
  'member_number',
  'sharing_member_id',
  'e123_member_id',
  // Address — contacts store the plain names, leads store the mailing_* ones.
  'city',
  'state',
  'mailing_city',
  'mailing_state',
  'company',
  'company_name',
  'email2',
  'secondary_email',
  'lead_status',
  'contact_status',
  ...JSON_PHONE_FIELD_KEYS,
];

/**
 * JSONB keys that hold a member's identifiers. PIFH member numbers are
 * all-digit (7–9 chars, 2,037 rows on 2026-08-17), so a numeric query looks
 * exactly like a phone fragment — the phone RPC never scans these keys, and
 * before this pass a real member number returned zero results.
 */
export const IDENTIFIER_SEARCH_JSON_KEYS = [
  'member_number',
  'sharing_member_id',
  'e123_member_id',
] as const;

/**
 * True when the query is a bare run of digits (≥ 4) — i.e. it might be a
 * phone fragment OR a member number, so global search must run BOTH the
 * phone lookup and the identifier ilike pass. Formatted phones
 * ("(303) 555-1212", "303-555…") stay phone-only.
 */
export function isNumericIdentifierQuery(rawQuery: string): boolean {
  const q = rawQuery.trim();
  return /^\d{4,20}$/.test(q);
}

/**
 * Single PostgREST `.or(...)` filter for the identifier pass:
 * `data->>member_number.ilike.%q%,data->>sharing_member_id.ilike.%q%,…`.
 * Empty string when the query is not usable (caller skips the pass).
 */
export function buildIdentifierSearchOrFilter(
  rawQuery: string,
  keys: readonly string[] = IDENTIFIER_SEARCH_JSON_KEYS,
): string {
  const q = rawQuery.trim();
  if (!q) return '';
  const pattern = `%${escapeIlikePattern(q)}%`;
  const parts: string[] = [];
  for (const key of keys) {
    if (!SAFE_DATA_JSON_KEY.test(key)) continue;
    parts.push(`data->>${key}.ilike.${pattern}`);
  }
  return parts.join(',');
}

/**
 * Merge two result lists by `id`, primary order first, then secondary rows not
 * already present, capped at `limit`. Used by /api/crm/search to put phone
 * hits ahead of identifier hits (and RPC hits ahead of ilike supplements).
 */
export function mergeUniqueByIdPreserveOrder<T extends { id: string }>(
  primary: readonly T[],
  secondary: readonly T[],
  limit: number,
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of primary) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
    if (out.length >= limit) return out;
  }
  for (const row of secondary) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Module-scoped search loads crm_fields keys; global spotlight uses a fixed core set.
 */
export async function resolveSearchDataJsonKeys(
  supabase: any,
  orgId: string,
  moduleKey: string | null,
): Promise<string[]> {
  if (!moduleKey) return CORE_GLOBAL_SEARCH_JSON_KEYS;
  return fetchOrgDataJsonKeysForSearch(supabase, orgId, moduleKey);
}

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

// ---------------------------------------------------------------------------
// Global search resolver (NV-4) — ONE resolver for the ⌘K palette
// (/api/crm/search) and the /crm/search page. Hybrid full-text + trigram RPC
// (`crm_smart_search`), digit-normalised phone lookup (`crm_phone_lookup`),
// member-# identifier pass, ilike fallbacks when an RPC is missing. Both
// callers scope by `profile.organization_id`; trashed rows are excluded on
// every path; converted leads are dropped (audit trail only).
// ---------------------------------------------------------------------------

/**
 * Row shape returned by the `crm_smart_search` Postgres RPC (and what every
 * other path is normalised to). Mirrors the function's RETURNS TABLE (...).
 */
export interface GlobalSearchRow {
  id: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  module_id: string;
  data: Record<string, unknown> | null;
  module_key: string;
  module_name: string;
  module_name_plural: string | null;
  match_type: 'exact' | 'fuzzy';
  rank: number;
}

export interface ResolveSearchRowsOptions {
  query: string;
  /** `crm_modules.key` to narrow to, or null for every module. */
  moduleFilter?: string | null;
  /** Max rows (callers clamp; the API caps at 100). */
  limit: number;
  /** Trigram similarity threshold 0..1 (lower = more hits). Default 0.2. */
  threshold?: number;
}

/** Default trigram similarity threshold shared by both callers. */
export const GLOBAL_SEARCH_DEFAULT_THRESHOLD = 0.2;

/**
 * Below this many RPC hits we also run the identifier/address ilike pass.
 * A name search that already returns a full page skips the extra query.
 */
const SUPPLEMENT_BELOW = 5;

/** Phone-ish input: ≥4 digits, ≤15, (almost) nothing but digits/separators, no '@'. */
function classifyDigits(searchQuery: string): { digits: string; phoneOnly: boolean; hasPhoneRun: boolean } {
  const digits = searchQuery.replace(/[^0-9]/g, '');
  const compactLen = Math.max(searchQuery.replace(/\s/g, '').length, 1);
  const digitRatio = digits.length / compactLen;
  const hasPhoneRun = digits.length >= 4 && digits.length <= 15 && !searchQuery.includes('@');
  return { digits, hasPhoneRun, phoneOnly: hasPhoneRun && digitRatio >= 0.88 };
}

/**
 * Resolve the rows a global search should show, in rank order, with converted
 * leads removed. Never throws on a failed secondary pass (logged, skipped).
 *
 *  - Phone-only query (digits / formatted phone): `crm_phone_lookup`; a bare
 *    digit run ALSO runs the member-# identifier pass (PIFH member numbers are
 *    all-digit) and merges it behind the phone hits.
 *  - Anything else: `crm_smart_search` (typo-tolerant), supplemented by the
 *    JSONB ilike pass when thin, plus phone hits when the text carries a
 *    phone fragment ("Jane 5551212").
 */
export async function resolveSearchRows(
  supabase: any,
  orgId: string,
  opts: ResolveSearchRowsOptions,
): Promise<GlobalSearchRow[]> {
  const searchQuery = opts.query.trim();
  if (!searchQuery) return [];
  const moduleFilter = opts.moduleFilter && opts.moduleFilter.trim().length > 0 ? opts.moduleFilter.trim() : null;
  const limit = opts.limit;
  const threshold = opts.threshold ?? GLOBAL_SEARCH_DEFAULT_THRESHOLD;
  const { digits, phoneOnly, hasPhoneRun } = classifyDigits(searchQuery);

  let rows: GlobalSearchRow[] = [];

  if (phoneOnly) {
    // PIFH member numbers are all-digit, so "1234567" is a phone fragment
    // AND a possible member number. Run both; phone hits stay first.
    const identifierPass = isNumericIdentifierQuery(searchQuery)
      ? identifierSearch(supabase, orgId, { query: searchQuery, moduleFilter, limit }).catch((e) => {
          console.warn('[search] identifier pass failed:', e);
          return [] as GlobalSearchRow[];
        })
      : Promise.resolve([] as GlobalSearchRow[]);
    const [phoneRows, identifierRows] = await Promise.all([
      phoneSearch(supabase, orgId, { rawQuery: searchQuery, digits, moduleFilter, limit }),
      identifierPass,
    ]);
    rows = mergeUniqueByIdPreserveOrder(phoneRows, identifierRows, limit);
  } else {
    rows = await smartSearch(supabase, orgId, { query: searchQuery, moduleFilter, limit, threshold });

    if (hasPhoneRun) {
      const phoneRows = await phoneSearch(supabase, orgId, {
        rawQuery: searchQuery,
        digits,
        moduleFilter,
        limit: Math.min(limit, 40),
      });
      rows = mergeUniqueByIdPreserveOrder(rows, phoneRows, limit);
    }
  }

  // Converted leads are intentionally kept as an audit trail, but they must
  // not surface in search beside the Contact they became — that pairing is
  // exactly what looks like a duplicate to reps. The lead stays reachable
  // from the contact's "converted from" link.
  return rows.filter((record) => !isConvertedLeadRow(record));
}

/**
 * Call the typo-tolerant `crm_smart_search` RPC.
 * Falls back to a simple ilike on title/email if the RPC is unavailable
 * (e.g. on a database where the migration hasn't run yet).
 */
async function smartSearch(
  supabase: any,
  orgId: string,
  opts: { query: string; moduleFilter: string | null; limit: number; threshold: number },
): Promise<GlobalSearchRow[]> {
  const { data, error } = await supabase.rpc('crm_smart_search', {
    p_org_id: orgId,
    p_query: opts.query,
    p_module_key: opts.moduleFilter,
    p_limit: opts.limit,
    p_similarity_threshold: opts.threshold,
  });

  if (!error && Array.isArray(data)) {
    const rows = data as GlobalSearchRow[];

    // The RPC matches on `crm_records.search`, a GENERATED tsvector whose
    // expression covers names/phone/email but NOT the identifier and address
    // keys Zoho-era rows are actually looked up by — searching a real member
    // number returned zero results. When the RPC comes back (near-)empty, run
    // the JSONB ilike pass, which does cover those keys, and merge.
    // Only on a thin result set, so ordinary name searches cost one query.
    if (rows.length >= SUPPLEMENT_BELOW) return rows;

    const supplement = await ilikeFallback(supabase, orgId, opts).catch((e) => {
      console.warn('[search] identifier supplement failed:', e);
      return [] as GlobalSearchRow[];
    });
    if (supplement.length === 0) return rows;

    // RPC hits keep their ranking and stay first; supplement fills in behind.
    return mergeUniqueByIdPreserveOrder(rows, supplement, opts.limit);
  }

  if (error) {
    console.warn('[search] crm_smart_search RPC failed, falling back to ilike:', error.message);
  }

  return ilikeFallback(supabase, orgId, opts);
}

/**
 * Phone search.
 *
 * Primary path: `crm_phone_lookup` RPC. The RPC strips non-digits from both
 * sides before comparing, so a query of `8005558888` matches DB rows stored
 * as `(800) 555-8888`, `1-800-555-8888`, `+1 800 555 8888`, etc., and also
 * scans the common `data->>'…phone…'` keys.
 *
 * Fallback (RPC not deployed yet): several common formatted variants of the
 * same number against the indexed `phone` column plus the JSONB phone keys.
 */
async function phoneSearch(
  supabase: any,
  orgId: string,
  opts: { rawQuery: string; digits: string; moduleFilter: string | null; limit: number },
): Promise<GlobalSearchRow[]> {
  const { data: rpcData, error: rpcError } = await supabase.rpc('crm_phone_lookup', {
    p_org_id: orgId,
    p_query: opts.digits,
    p_module_key: opts.moduleFilter,
    p_limit: opts.limit,
  });

  if (!rpcError && Array.isArray(rpcData)) {
    return rpcData as GlobalSearchRow[];
  }

  if (rpcError) {
    console.warn('[search] crm_phone_lookup RPC failed, falling back to multi-format ilike:', rpcError.message);
  }

  return phoneIlikeFallback(supabase, orgId, opts);
}

const GLOBAL_SEARCH_SELECT = `
      id, title, email, phone, status, module_id, data,
      crm_modules!inner ( id, key, name, name_plural )
    `;

/** Normalise a `crm_records` + `crm_modules` join row to the RPC row shape. */
function joinRowToSearchRow(
  row: any,
  rank: number,
): GlobalSearchRow {
  return {
    id: row.id,
    title: row.title,
    email: row.email,
    phone: row.phone,
    status: row.status,
    module_id: row.module_id,
    data: row.data,
    module_key: row.crm_modules.key,
    module_name: row.crm_modules.name,
    module_name_plural: row.crm_modules.name_plural,
    match_type: 'exact',
    rank,
  };
}

/**
 * Multi-format phone fallback used when `crm_phone_lookup` is unavailable.
 * PostgREST's `.or()` can't regexp_replace inline, so enumerate the common
 * presentations and ilike-substring each one.
 */
async function phoneIlikeFallback(
  supabase: any,
  orgId: string,
  opts: { rawQuery: string; digits: string; moduleFilter: string | null; limit: number },
): Promise<GlobalSearchRow[]> {
  const dataJsonKeys = await resolveSearchDataJsonKeys(supabase, orgId, opts.moduleFilter);
  const filter = buildPhoneSearchOrFilter(opts.rawQuery, { dataJsonKeys });
  if (!filter) return [];

  let qb = supabase
    .from('crm_records')
    .select(GLOBAL_SEARCH_SELECT)
    .eq('org_id', orgId)
    // Keep soft-deleted (trashed) records out of the phone fallback — the
    // smart-search RPC already excludes them; this path must match.
    .is('deleted_at', null)
    .or(filter)
    .limit(opts.limit);

  if (opts.moduleFilter) {
    qb = qb.eq('crm_modules.key', opts.moduleFilter);
  }

  const { data, error } = await qb;
  if (error) {
    console.error('[search] phone ilike fallback failed:', error);
    return [];
  }
  return (data || []).map((row: any) => joinRowToSearchRow(row, 1));
}

/**
 * Identifier pass for numeric queries: substring ilike on the member-id JSONB
 * keys (`IDENTIFIER_SEARCH_JSON_KEYS`). Org-scoped, trashed rows excluded,
 * same row shape as the other paths so results merge cleanly.
 */
async function identifierSearch(
  supabase: any,
  orgId: string,
  opts: { query: string; moduleFilter: string | null; limit: number },
): Promise<GlobalSearchRow[]> {
  const filter = buildIdentifierSearchOrFilter(opts.query);
  if (!filter) return [];

  let qb = supabase
    .from('crm_records')
    .select(GLOBAL_SEARCH_SELECT)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .or(filter)
    // Stable order so an over-limit identifier match returns the same rows
    // on every call (most recently touched first).
    .order('updated_at', { ascending: false })
    .limit(opts.limit);

  if (opts.moduleFilter) {
    qb = qb.eq('crm_modules.key', opts.moduleFilter);
  }

  const { data, error } = await qb;
  if (error) {
    console.error('[search] identifier pass failed:', error);
    return [];
  }
  return (data || []).map((row: any) => joinRowToSearchRow(row, 0.75));
}

/**
 * Last-resort fallback used when the RPC errors out (and the thin-result
 * supplement). Pure ilike — no fuzzy tolerance, but it still tries multiple
 * phone formats and the JSONB identifier/address keys.
 */
async function ilikeFallback(
  supabase: any,
  orgId: string,
  opts: { query: string; moduleFilter: string | null; limit: number },
): Promise<GlobalSearchRow[]> {
  const dataJsonKeys = await resolveSearchDataJsonKeys(supabase, orgId, opts.moduleFilter);

  let qb = supabase
    .from('crm_records')
    .select(GLOBAL_SEARCH_SELECT)
    .eq('org_id', orgId)
    // Last-resort ilike path must also hide trashed records, matching the
    // crm_smart_search RPC (202607140004_crm_search_exclude_trashed).
    .is('deleted_at', null)
    .limit(opts.limit);

  if (opts.moduleFilter) {
    qb = qb.eq('crm_modules.key', opts.moduleFilter);
  }

  qb = applyCrmRecordTextSearch(qb, opts.query, { dataJsonKeys });

  const { data, error } = await qb;
  if (error) {
    console.error('[search] ilike fallback failed:', error);
    return [];
  }
  return (data || []).map((row: any) => joinRowToSearchRow(row, 0.5));
}

/** Display title for a search row: `title`, else first + last name, else "Untitled". */
export function searchRowDisplayTitle(row: Pick<GlobalSearchRow, 'title' | 'data'>): string {
  const data = (row.data || {}) as Record<string, unknown>;
  const fallbackName = [data.first_name, data.last_name].filter(Boolean).join(' ').trim();
  return row.title?.trim() || fallbackName || 'Untitled';
}
