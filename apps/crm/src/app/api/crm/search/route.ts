import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

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
 *   - threshold: trigram similarity threshold 0..1 (default 0.25)
 *
 * Phone-number queries skip the RPC and use a digit-normalised ilike,
 * because trigram on a numeric string is noisy.
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
    const moduleFilter = searchParams.get('module');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const threshold = clamp01(
      parseFloat(searchParams.get('threshold') || '0.25'),
      0.25,
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
    const isPhoneQuery =
      phoneDigits.length >= 4 &&
      phoneDigits.length <= 15 &&
      // Treat queries that are mostly digits as phone lookups.
      phoneDigits.length / searchQuery.length > 0.6;

    let rows: SmartSearchRow[] = [];

    if (isPhoneQuery) {
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
 * Phone search: normalize to digits, match the last-10-digit suffix,
 * then enrich with module info via a join.
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
  const safeRaw = opts.rawQuery.replace(/[%_\\]/g, '\\$&');
  const tail = opts.digits.slice(-10);

  let qb = supabase
    .from('crm_records')
    .select(
      `
      id, title, email, phone, status, module_id, data,
      crm_modules!inner ( id, key, name, name_plural )
    `,
    )
    .eq('org_id', orgId)
    .or(`phone.ilike.%${tail}%,phone.ilike.%${safeRaw}%,title.ilike.%${safeRaw}%`)
    .limit(opts.limit);

  if (opts.moduleFilter) {
    qb = qb.eq('crm_modules.key', opts.moduleFilter);
  }

  const { data, error } = await qb;
  if (error) {
    console.error('[search] phone search failed:', error);
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
 * fuzzy tolerance, but at least the search bar still works.
 */
async function ilikeFallback(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  opts: { query: string; moduleFilter: string | null; limit: number },
): Promise<SmartSearchRow[]> {
  const safe = opts.query.replace(/[%_\\]/g, '\\$&');

  let qb = supabase
    .from('crm_records')
    .select(
      `
      id, title, email, phone, status, module_id, data,
      crm_modules!inner ( id, key, name, name_plural )
    `,
    )
    .eq('org_id', orgId)
    .or(`title.ilike.%${safe}%,email.ilike.%${safe}%`)
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

function clamp01(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
