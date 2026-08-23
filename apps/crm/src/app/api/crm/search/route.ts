import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import {
  GLOBAL_SEARCH_DEFAULT_THRESHOLD,
  resolveSearchRows,
  searchRowDisplayTitle,
} from '@/lib/crm/record-search';
import {
  getRecordSearchMatches,
  type RecordSearchMatch,
} from '@/lib/crm/search-match';

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
  /** Which field(s) matched, for colour-coded chips (empty for fuzzy-only hits). */
  matches?: RecordSearchMatch[];
}

interface SearchResponse {
  query: string;
  results: SearchResult[];
  totalCount: number;
  modules: Record<string, number>;
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
 *   - limit: max results (default 50, max 100)
 *   - threshold: trigram similarity threshold 0..1 (default 0.2; lower = more hits)
 *
 * The resolver (phone variants, member #, fuzzy, fallbacks) lives in
 * lib/crm/record-search.ts `resolveSearchRows` and is shared with the
 * /crm/search page (NV-4) — same org scoping, same rows.
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
      parseFloat(searchParams.get('threshold') || String(GLOBAL_SEARCH_DEFAULT_THRESHOLD)),
      GLOBAL_SEARCH_DEFAULT_THRESHOLD,
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
    const visibleRows = await resolveSearchRows(supabase, profile.organization_id, {
      query: searchQuery,
      moduleFilter,
      limit,
      threshold,
    });

    const results: SearchResult[] = visibleRows.map((record) => {
      const data = record.data || {};
      const subtitleParts: string[] = [];
      if (record.email) subtitleParts.push(record.email);
      if (record.phone) subtitleParts.push(record.phone);
      if (record.status) subtitleParts.push(record.status);

      // Attribute the hit to specific field(s) so the UI can show colour-coded
      // "matched field" chips. Derived from the columns the RPC returns; a
      // fuzzy/typo-tolerant hit with no literal substring simply yields none.
      const matches = getRecordSearchMatches(
        {
          title: record.title,
          email: record.email,
          phone: record.phone,
          status: record.status,
          data,
        },
        searchQuery,
        { maxMatches: 3 },
      );

      return {
        id: record.id,
        title: searchRowDisplayTitle(record),
        subtitle: subtitleParts.join(' · ') || undefined,
        module: record.module_name_plural || record.module_name,
        moduleKey: record.module_key,
        url: `/crm/r/${record.id}`,
        matchType: record.match_type,
        matches: matches.length > 0 ? matches : undefined,
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

function clamp01(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
