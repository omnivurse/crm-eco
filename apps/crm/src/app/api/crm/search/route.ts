import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import {
  buildPhoneSearchOrFilter,
  escapeIlikePattern,
  phoneFormatVariants,
} from '@/lib/crm/record-search';

export const dynamic = 'force-dynamic';

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  module: string;
  moduleKey: string;
  url: string;
  /** 'exact' = full-text prefix hit, 'fuzzy' = trigram similarity hit */
  matchType?: 'exact' | 'fuzzy';
}

interface SearchResponse {
  query: string;
  results: SearchResult[];
  totalCount: number;
  modules: Record<string, number>;
}

/**
 * Row shape returned by the `crm_smart_search` Postgres RPC.
 * Mirrors the function's RETURNS TABLE (...) signature.
 */
interface SmartSearchRow {
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

/**
 * GET /api/crm/search
 *
 * Global search endpoint that searches across CRM records using a hybrid
 * full-text + trigram-similarity strategy (see migration
 * 202604230001_crm_smart_search.sql). This makes the search typo-tolerant
 * the way Zoho's global search behaves — e.g. "Bollman" still finds
 * "Bollmann".
 *
 * Query params:
 *   - q: search query (required)
 *   - module: filter by module key (optional)
 *   - limit: max results (default 20, max 100)
 *   - threshold: trigram similarity threshold 0..1 (default 0.2; lower = more hits)
 *
 * Phone-heavy queries use digit-normalized matching; mixed queries (e.g. name + number)
 * merge text RPC results with phone hits.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const rawQuery = searchParams.get('q');
    const rawModule = searchParams.get('module');
    // Empty string must not reach the SQL `m.key = p_module_key` branch (would match nothing).
    const moduleFilter =
      rawModule && rawModule.trim().length > 0 ? rawModule.trim() : null;
    // Default 50 (was 20). Common-name searches (e.g. "Johnson" — 104 records
    // in PIFH) need a deeper bucket so a specific person isn't randomly cut
    // off when they share rank with dozens of homonyms. Hard cap stays 100.
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const threshold = clamp01(
      parseFloat(searchParams.get('threshold') || '0.2'),
      0.2,
    );

    if (!rawQuery || rawQuery.trim().length === 0) {
      return NextResponse.json({
        query: '',
        results: [],
        totalCount: 0,
        modules: {},
      } satisfies SearchResponse);
    }

    const searchQuery = rawQuery.trim();
    const phoneDigits = searchQuery.replace(/[^0-9]/g, '');
    const compactLen = Math.max(searchQuery.replace(/\s/g, '').length, 1);
    const digitRatio = phoneDigits.length / compactLen;
    // Near-all-digits (or formatted phone) → dedicated phone path; otherwise hybrid merge.
    const isPhoneOnlyQuery =
      phoneDigits.length >= 4 &&
      phoneDigits.length <= 15 &&
      digitRatio >= 0.88 &&
      !searchQuery.includes('@');

    let rows: SmartSearchRow[] = [];

    if (isPhoneOnlyQuery) {
      rows = await phoneSearch(supabase, profile.organization_id, {
        rawQuery: searchQuery,
        digits: phoneDigits,
        moduleFilter,
        limit,
      });
    } else {
      rows = await smartSearch(supabase, profile.organization_id, {
        query: searchQuery,
        moduleFilter,
        limit,
        threshold,
      });

      if (
        phoneDigits.length >= 4 &&
        phoneDigits.length <= 15 &&
        !searchQuery.includes('@')
      ) {
        const phoneRows = await phoneSearch(supabase, profile.organization_id, {
          rawQuery: searchQuery,
          digits: phoneDigits,
          moduleFilter,
          limit: Math.min(limit, 40),
        });
        rows = mergeUniqueByIdPreserveOrder(rows, phoneRows, limit);
      }
    }

    const results: SearchResult[] = rows.map((record) => {
      const data = record.data || {};
      const subtitleParts: string[] = [];
      if (record.email) subtitleParts.push(record.email);
      if (record.phone) subtitleParts.push(record.phone);
      if (record.status) subtitleParts.push(record.status);

      const fallbackName = [
        (data as Record<string, unknown>).first_name,
        (data as Record<string, unknown>).last_name,
      ]
        .filter(Boolean)
        .join(' ')
        .trim();

      return {
        id: record.id,
        title: record.title?.trim() || fallbackName || 'Untitled',
        subtitle: subtitleParts.join(' · ') || undefined,
        module: record.module_name_plural || record.module_name,
        moduleKey: record.module_key,
        url: `/crm/r/${record.id}`,
        matchType: record.match_type,
      };
    });

    const moduleCounts: Record<string, number> = {};
    for (const r of results) {
      moduleCounts[r.moduleKey] = (moduleCounts[r.moduleKey] || 0) + 1;
    }

    const response: SearchResponse = {
      query: searchQuery,
      results,
      totalCount: results.length,
      modules: moduleCounts,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[search] API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * Call the typo-tolerant `crm_smart_search` RPC.
 * Falls back to a simple ilike on title/email if the RPC is unavailable
 * (e.g. on a database where the migration hasn't run yet).
 */
async function smartSearch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  opts: {
    query: string;
    moduleFilter: string | null;
    limit: number;
    threshold: number;
  },
): Promise<SmartSearchRow[]> {
  const { data, error } = await supabase.rpc('crm_smart_search', {
    p_org_id: orgId,
    p_query: opts.query,
    p_module_key: opts.moduleFilter,
    p_limit: opts.limit,
    p_similarity_threshold: opts.threshold,
  });

  if (!error && Array.isArray(data)) {
    return data as SmartSearchRow[];
  }

  if (error) {
    console.warn(
      '[search] crm_smart_search RPC failed, falling back to ilike:',
      error.message,
    );
  }

  return ilikeFallback(supabase, orgId, opts);
}

/**
 * Phone search.
 *
 * Primary path: `crm_phone_lookup` RPC. The RPC strips non-digits from both
 * sides before comparing, so a query of `8005558888` matches DB rows stored
 * as `(800) 555-8888`, `1-800-555-8888`, `+1 800 555 8888`, etc., and also
 * scans `data->>'mobile'`, `data->>'work_phone'`, `data->>'home_phone'`,
 * `data->>'cell'`, `data->>'mobile_phone'`, `data->>'cell_phone'`,
 * `data->>'phone_number'` so it picks up phones stored under any common key.
 *
 * Fallback (RPC not deployed yet): try several common formatted variants of
 * the same number against the indexed `phone` column, plus a digits-only
 * substring against `data::text`. Best-effort but still matches the most
 * common stored phone formats.
 */
async function phoneSearch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  opts: {
    rawQuery: string;
    digits: string;
    moduleFilter: string | null;
    limit: number;
  },
): Promise<SmartSearchRow[]> {
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'crm_phone_lookup',
    {
      p_org_id: orgId,
      p_query: opts.digits,
      p_module_key: opts.moduleFilter,
      p_limit: opts.limit,
    },
  );

  if (!rpcError && Array.isArray(rpcData)) {
    return rpcData as SmartSearchRow[];
  }

  if (rpcError) {
    console.warn(
      '[search] crm_phone_lookup RPC failed, falling back to multi-format ilike:',
      rpcError.message,
    );
  }

  return phoneIlikeFallback(supabase, orgId, opts);
}

/**
 * Multi-format phone fallback used when `crm_phone_lookup` is unavailable.
 *
 * Tries each common formatting of the digits the user typed against the raw
 * `phone` column. PostgREST's `.or()` doesn't allow regexp_replace inline,
 * so this is the best we can do without an RPC: enumerate the common
 * presentations and ilike-substring each one.
 */
async function phoneIlikeFallback(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  opts: {
    rawQuery: string;
    digits: string;
    moduleFilter: string | null;
    limit: number;
  },
): Promise<SmartSearchRow[]> {
  const filter = buildPhoneSearchOrFilter(opts.rawQuery);
  if (!filter) {
    return [];
  }

  let qb = supabase
    .from('crm_records')
    .select(
      `
      id, title, email, phone, status, module_id, data,
      crm_modules!inner ( id, key, name, name_plural )
    `,
    )
    .eq('org_id', orgId)
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

  return (data || []).map((row: any): SmartSearchRow => ({
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
    rank: 1,
  }));
}

/**
 * Last-resort fallback used when the RPC errors out. Pure ilike — no
 * fuzzy tolerance, but it still tries multiple phone formats so a
 * `(800) 555-8888` query finds an `8005558888` row (and vice-versa) even
 * when the smart-search RPC isn't deployed.
 */
async function ilikeFallback(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  opts: { query: string; moduleFilter: string | null; limit: number },
): Promise<SmartSearchRow[]> {
  const safe = escapeIlikePattern(opts.query);
  const digits = opts.query.replace(/\D/g, '');

  const orClauses = new Set<string>([
    `title.ilike.%${safe}%`,
    `email.ilike.%${safe}%`,
    `phone.ilike.%${safe}%`,
    `data::text.ilike.%${safe}%`,
  ]);

  // If the query contains enough digits to be phone-like, also widen to
  // the common phone presentations.
  if (digits.length >= 4 && digits.length <= 15) {
    for (const v of phoneFormatVariants(digits)) {
      orClauses.add(`phone.ilike.%${escapeIlikePattern(v)}%`);
    }
    orClauses.add(`data::text.ilike.%${escapeIlikePattern(digits)}%`);
    const tail = digits.slice(-10);
    if (tail && tail !== digits) {
      orClauses.add(`data::text.ilike.%${escapeIlikePattern(tail)}%`);
    }
  }

  let qb = supabase
    .from('crm_records')
    .select(
      `
      id, title, email, phone, status, module_id, data,
      crm_modules!inner ( id, key, name, name_plural )
    `,
    )
    .eq('org_id', orgId)
    .or(Array.from(orClauses).join(','))
    .limit(opts.limit);

  if (opts.moduleFilter) {
    qb = qb.eq('crm_modules.key', opts.moduleFilter);
  }

  const { data, error } = await qb;
  if (error) {
    console.error('[search] ilike fallback failed:', error);
    return [];
  }

  return (data || []).map((row: any): SmartSearchRow => ({
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
    rank: 0.5,
  }));
}

function mergeUniqueByIdPreserveOrder(
  primary: SmartSearchRow[],
  secondary: SmartSearchRow[],
  limit: number,
): SmartSearchRow[] {
  const seen = new Set<string>();
  const out: SmartSearchRow[] = [];
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

function clamp01(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
