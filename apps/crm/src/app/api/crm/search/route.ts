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
 * Global search endpoint that searches across CRM records
 * Query params:
 *   - q: search query (required)
 *   - module: filter by module key (optional)
 *   - limit: max results (default 20)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const moduleFilter = searchParams.get('module');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    if (!query || query.trim().length === 0) {
      return NextResponse.json({
        query: '',
        results: [],
        totalCount: 0,
        modules: {},
      } satisfies SearchResponse);
    }

    const searchQuery = query.trim();
    const phoneDigits = searchQuery.replace(/[^0-9]/g, '');
    const isPhoneQuery = phoneDigits.length >= 4 && phoneDigits.length <= 15;

    let searchQueryBuilder = supabase
      .from('crm_records')
      .select(`
        id,
        title,
        email,
        phone,
        status,
        module_id,
        data,
        crm_modules!inner (
          id,
          key,
          name,
          name_plural
        )
      `)
      .eq('org_id', profile.organization_id);

    if (isPhoneQuery) {
      searchQueryBuilder = searchQueryBuilder.or(
        `phone.ilike.%${phoneDigits.slice(-10)}%,phone.ilike.%${searchQuery}%,title.ilike.%${searchQuery}%`
      );
    } else {
      const prefixQuery = searchQuery
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => `${w}:*`)
        .join(' & ');
      searchQueryBuilder = searchQueryBuilder.textSearch('search', prefixQuery, {
        type: 'plain',
        config: 'english',
      });
    }

    searchQueryBuilder = searchQueryBuilder.limit(limit);

    // Apply module filter if specified
    if (moduleFilter) {
      searchQueryBuilder = searchQueryBuilder.eq('crm_modules.key', moduleFilter);
    }

    const { data: records, error: searchError } = await searchQueryBuilder;

    if (searchError) {
      console.error('Search error:', searchError);
      return NextResponse.json(
        { error: 'Search failed' },
        { status: 500 }
      );
    }

    // Transform results
    const results: SearchResult[] = (records || []).map((record: any) => {
      const recordModule = record.crm_modules;
      const data = record.data || {};

      // Build subtitle from available data
      const subtitleParts: string[] = [];
      if (record.email) subtitleParts.push(record.email);
      if (record.phone) subtitleParts.push(record.phone);
      if (record.status) subtitleParts.push(record.status);

      return {
        id: record.id,
        title: record.title || data.first_name
          ? `${data.first_name || ''} ${data.last_name || ''}`.trim()
          : 'Untitled',
        subtitle: subtitleParts.join(' · ') || undefined,
        module: recordModule.name_plural || recordModule.name,
        moduleKey: recordModule.key,
        url: `/crm/r/${record.id}`,
      };
    });

    // Count by module
    const moduleCounts: Record<string, number> = {};
    results.forEach((r) => {
      moduleCounts[r.moduleKey] = (moduleCounts[r.moduleKey] || 0) + 1;
    });

    const response: SearchResponse = {
      query: searchQuery,
      results,
      totalCount: results.length,
      modules: moduleCounts,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
