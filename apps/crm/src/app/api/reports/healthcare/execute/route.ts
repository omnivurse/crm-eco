import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const VALID_TEMPLATES = [
  'network-coverage-report',
  'network-provider-search-report',
] as const;

type HealthcareTemplate = (typeof VALID_TEMPLATES)[number];

function buildCacheKey(templateKey: string, filters: Record<string, unknown>): string {
  const sortedFilters = JSON.stringify(filters, Object.keys(filters).sort());
  return crypto.createHash('md5').update(`${templateKey}:${sortedFilters}`).digest('hex');
}

/**
 * POST /api/reports/healthcare/execute
 * Execute a healthcare report template with filters and caching.
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { templateKey, filters = {} } = body;

    if (!templateKey || !VALID_TEMPLATES.includes(templateKey as HealthcareTemplate)) {
      return NextResponse.json(
        { error: `Invalid template. Valid templates: ${VALID_TEMPLATES.join(', ')}` },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const cacheKey = buildCacheKey(templateKey, filters);

    // Check cache first
    const { data: cached } = await supabase
      .from('crm_report_results_cache')
      .select('*')
      .eq('org_id', profile.organization_id)
      .eq('cache_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (cached) {
      return NextResponse.json({
        data: cached.result_data,
        summary: cached.result_summary,
        rowCount: cached.row_count,
        computedAt: cached.computed_at,
        fromCache: true,
      });
    }

    // Execute the appropriate report
    let data: unknown[] = [];
    let summary: Record<string, unknown> = {};

    const template = templateKey as HealthcareTemplate;

    if (template === 'network-coverage-report') {
      const { network_id, state, zip_code } = filters as {
        network_id?: string;
        state?: string;
        zip_code?: string;
      };

      if (!network_id) {
        return NextResponse.json({ error: 'network_id filter is required' }, { status: 400 });
      }

      const { data: rpcData, error } = await supabase.rpc('get_network_coverage_score', {
        p_network_id: network_id,
        p_zip_code: zip_code || null,
        p_state: state || null,
      });

      if (error) {
        console.error('Coverage report error:', error);
        return NextResponse.json({ error: 'Failed to run coverage report' }, { status: 500 });
      }

      data = rpcData || [];
      const scores = (data as Array<{ coverage_score: number; total_providers: number }>);
      summary = {
        total_zips: scores.length,
        avg_coverage_score: scores.length > 0
          ? Number((scores.reduce((s, r) => s + Number(r.coverage_score), 0) / scores.length).toFixed(1))
          : 0,
        total_providers: scores.reduce((s, r) => s + Number(r.total_providers), 0),
      };
    } else if (template === 'network-provider-search-report') {
      const { network_id, zip_code, service_category, radius } = filters as {
        network_id?: string;
        zip_code?: string;
        service_category?: string;
        radius?: number;
      };

      if (!network_id || !zip_code) {
        return NextResponse.json(
          { error: 'network_id and zip_code filters are required' },
          { status: 400 }
        );
      }

      const { data: rpcData, error } = await supabase.rpc('search_in_network_providers', {
        p_network_id: network_id,
        p_zip_code: zip_code,
        p_service_category: service_category || null,
        p_tier: null,
        p_radius_miles: radius || 50,
        p_limit: 100,
      });

      if (error) {
        console.error('Provider search report error:', error);
        return NextResponse.json({ error: 'Failed to run provider search report' }, { status: 500 });
      }

      data = rpcData || [];
      const providers = data as Array<{ network_tier: string; distance_miles: number | null }>;
      const distances = providers.filter((p) => p.distance_miles != null).map((p) => p.distance_miles!);
      summary = {
        total_providers: providers.length,
        preferred_count: providers.filter((p) => p.network_tier === 'in_network_preferred').length,
        in_network_count: providers.filter((p) => p.network_tier === 'in_network').length,
        avg_distance: distances.length > 0
          ? Number((distances.reduce((s, d) => s + d, 0) / distances.length).toFixed(1))
          : null,
      };
    }

    // Cache the results (15 min TTL)
    await supabase.from('crm_report_results_cache').upsert(
      {
        org_id: profile.organization_id,
        cache_key: cacheKey,
        template_key: templateKey,
        filters_hash: cacheKey,
        result_data: data,
        result_summary: summary,
        row_count: data.length,
        computed_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      },
      { onConflict: 'org_id,cache_key' }
    );

    // Log in report_run_history (fire-and-forget). Template reports do not
    // have a row in crm_reports; rely on the nullable report_id column from
    // migration 202605220009 and store the template name in template_key.
    await supabase
      .from('report_run_history')
      .insert({
        organization_id: profile.organization_id,
        report_id: null,
        template_key: templateKey,
        executed_by: profile.id,
        filters_used: filters,
        row_count: data.length,
        status: 'completed',
      })
      .then(() => {});

    return NextResponse.json({
      data,
      summary,
      rowCount: data.length,
      computedAt: new Date().toISOString(),
      fromCache: false,
    });
  } catch (error) {
    console.error('Error in POST /api/reports/healthcare/execute:', error);
    return NextResponse.json({ error: 'Failed to execute report' }, { status: 500 });
  }
}
