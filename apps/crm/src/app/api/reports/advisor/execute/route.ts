import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import crypto from 'crypto';
import {
  expandEnrollmentStatusFilter,
  unwrapAdvisorRpcResult,
} from '@crm-eco/lib/analytics';

export const dynamic = 'force-dynamic';

const VALID_TEMPLATES = [
  'advisor-enrollments',
  'advisor-active-members',
  'advisor-cancellations',
  'advisor-revenue',
] as const;

type AdvisorTemplate = (typeof VALID_TEMPLATES)[number];

const TEMPLATE_RPC_MAP: Record<AdvisorTemplate, string> = {
  'advisor-enrollments': 'rpc_advisor_enrollment_report',
  'advisor-active-members': 'rpc_advisor_active_members_report',
  'advisor-cancellations': 'rpc_advisor_cancellations_report',
  'advisor-revenue': 'rpc_advisor_revenue_report',
};

function buildCacheKey(templateKey: string, filters: Record<string, unknown>): string {
  const sortedFilters = JSON.stringify(filters, Object.keys(filters).sort());
  return crypto.createHash('md5').update(`${templateKey}:${sortedFilters}`).digest('hex');
}

async function resolveAdvisorIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  advisorIds: string[] | undefined,
  advisorSearch: string | undefined,
): Promise<string[] | null> {
  if (advisorIds?.length) return advisorIds;
  const query = advisorSearch?.trim().replace(/[,()]/g, ' ');
  if (!query) return null;

  const pattern = `%${query}%`;
  const { data } = await supabase
    .from('advisors')
    .select('id')
    .eq('organization_id', orgId)
    .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},npn.ilike.${pattern}`)
    .limit(50);

  return (data ?? []).map((row) => row.id);
}

export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      templateKey,
      advisorIds,
      advisorSearch,
      includeDownline = false,
      dateStart,
      dateEnd,
      states,
      planNames,
      planTypes,
      statuses,
      metric,
      skipCache = false,
    } = body;

    if (!templateKey || !VALID_TEMPLATES.includes(templateKey)) {
      return NextResponse.json(
        { error: `Invalid template. Must be one of: ${VALID_TEMPLATES.join(', ')}` },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const orgId = profile.organization_id;
    const resolvedAdvisorIds = await resolveAdvisorIds(supabase, orgId, advisorIds, advisorSearch);
    const expandedStatuses = expandEnrollmentStatusFilter(statuses);

    const filterHash = buildCacheKey(templateKey, {
      advisorIds: resolvedAdvisorIds,
      includeDownline,
      dateStart,
      dateEnd,
      states,
      planNames,
      planTypes,
      statuses: expandedStatuses,
      metric,
    });

    if (!skipCache) {
      const { data: cached } = await supabase
        .from('crm_report_results_cache')
        .select('result_data, result_summary, row_count, computed_at')
        .eq('org_id', orgId)
        .eq('cache_key', filterHash)
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
    }

    const rpcName = TEMPLATE_RPC_MAP[templateKey as AdvisorTemplate];
    const rpcParams: Record<string, unknown> = {
      p_org_id: orgId,
      p_advisor_ids: resolvedAdvisorIds?.length ? resolvedAdvisorIds : null,
      p_include_downline: includeDownline,
    };

    switch (templateKey) {
      case 'advisor-enrollments':
        rpcParams.p_date_start = dateStart || null;
        rpcParams.p_date_end = dateEnd || null;
        rpcParams.p_states = states?.length ? states : null;
        rpcParams.p_plan_names = planNames?.length ? planNames : null;
        rpcParams.p_statuses = expandedStatuses;
        break;
      case 'advisor-active-members':
        rpcParams.p_states = states?.length ? states : null;
        rpcParams.p_plan_names = planNames?.length ? planNames : null;
        rpcParams.p_plan_types = planTypes?.length ? planTypes : null;
        break;
      case 'advisor-cancellations':
        rpcParams.p_date_start = dateStart || null;
        rpcParams.p_date_end = dateEnd || null;
        rpcParams.p_states = states?.length ? states : null;
        break;
      case 'advisor-revenue':
        rpcParams.p_date_start = dateStart || null;
        rpcParams.p_date_end = dateEnd || null;
        break;
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc(rpcName, rpcParams);

    if (rpcError) {
      console.error(`[Advisor Report] RPC ${rpcName} error:`, rpcError);
      return NextResponse.json(
        { error: 'Report execution failed: ' + rpcError.message },
        { status: 500 }
      );
    }

    const { rows, total } = unwrapAdvisorRpcResult(rpcData);
    const rowCount = typeof total === 'number' ? total : rows.length;
    const summary = buildSummary(templateKey as AdvisorTemplate, rows);

    await supabase.from('crm_report_results_cache').upsert(
      {
        org_id: orgId,
        cache_key: filterHash,
        template_key: templateKey,
        filters_hash: filterHash,
        result_data: rows,
        result_summary: summary,
        row_count: rowCount,
        computed_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      },
      { onConflict: 'org_id,cache_key' }
    );

    await supabase
      .from('report_run_history')
      .insert({
        organization_id: orgId,
        report_id: null,
        template_key: templateKey,
        executed_by: profile.id,
        filters_used: {
          advisorIds: resolvedAdvisorIds,
          includeDownline,
          dateStart,
          dateEnd,
          states,
          planNames,
          planTypes,
          statuses: expandedStatuses,
        },
        row_count: rowCount,
        status: 'completed',
      })
      .then(() => {}, () => {});

    return NextResponse.json({
      data: rows,
      summary,
      rowCount,
      computedAt: new Date().toISOString(),
      fromCache: false,
    });
  } catch (error) {
    console.error('[Advisor Report] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to execute advisor report' },
      { status: 500 }
    );
  }
}

function buildSummary(template: AdvisorTemplate, rows: Record<string, unknown>[]): Record<string, unknown> {
  if (rows.length === 0) return { total: 0 };

  switch (template) {
    case 'advisor-enrollments': {
      const total = rows.reduce((s, r) => s + ((r.total_enrollments as number) || 0), 0);
      const active = rows.reduce(
        (s, r) => s + ((r.approved_or_active_count as number) || (r.active_count as number) || (r.active as number) || 0),
        0,
      );
      const pending = rows.reduce(
        (s, r) => s + ((r.pending_review_count as number) || (r.pending_count as number) || (r.pending as number) || 0),
        0,
      );
      return { totalEnrollments: total, active, pending, advisorCount: rows.length };
    }
    case 'advisor-active-members': {
      const total = rows.reduce((s, r) => s + ((r.active_members as number) || 0), 0);
      return { totalActiveMembers: total, advisorCount: rows.length };
    }
    case 'advisor-cancellations': {
      const total = rows.reduce((s, r) => s + ((r.cancelled_count as number) || 0), 0);
      const terminated = rows.reduce((s, r) => s + ((r.terminated_count as number) || 0), 0);
      return { totalCancelled: total, totalTerminated: terminated, advisorCount: rows.length };
    }
    case 'advisor-revenue': {
      const gross = rows.reduce((s, r) => s + ((r.gross_commissions as number) || 0), 0);
      const net = rows.reduce((s, r) => s + ((r.net_commissions as number) || 0), 0);
      return { grossRevenue: gross, netRevenue: net, advisorCount: rows.length };
    }
    default:
      return { total: rows.length };
  }
}
