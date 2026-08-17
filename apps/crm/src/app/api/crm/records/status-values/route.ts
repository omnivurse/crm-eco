/**
 * GET /api/crm/records/status-values?module_key=contacts
 *
 * Distinct raw `crm_records.status` values for ONE module of the caller's
 * org, with a count and the read-side lane each spelling belongs to
 * (lib/crm/status-lanes). Feeds the QuickFilterChips lane counts and the
 * Filters status picker. Nothing is rewritten — the client's free-text
 * spellings come back exactly as stored.
 *
 * Response:
 *   {
 *     module_key: string,
 *     values: Array<{ value: string; count: number; lane: StatusLane }>, // count desc
 *     lanes:  Array<{ lane: StatusLane; count: number }>,               // contract order
 *     total: number,                                                     // rows with a status
 *   }
 *
 * Counting: one `execute_report_aggregation` RPC (existing, SECURITY DEFINER,
 * org-scoped by the server-verified profile.organization_id) → GROUP BY
 * status WHERE deleted_at IS NULL. That RPC does not apply per-row RLS, so
 * for row-restricted roles (advisor → downline-only SELECT policy) the lane
 * totals are re-counted through the RLS client (`status IN (lane values)`,
 * HEAD count) so a chip's number always equals the list it opens. CRM
 * members / admins see the org-wide rows in the list too, so the RPC counts
 * are already exact for them.
 *
 * Caching: `Cache-Control: private, max-age=60` (per browser, per user) —
 * counts drift by a minute at most; the list itself is never cached.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import {
  STATUS_LANES,
  groupStatusValuesByLane,
  parseStatusValuesRpcResult,
  statusLane,
  statusValuesRpcArgs,
  type StatusLane,
} from '@/lib/crm/status-lanes';

export const dynamic = 'force-dynamic';

const CACHE_HEADERS = { 'Cache-Control': 'private, max-age=60' };

/**
 * Roles whose crm_records SELECT policy is narrower than the org.
 *
 * Mirrors the live `crm_records` SELECT policies (pg_policies, read 2026-08-17):
 *   - "Advisors can view downline records"  — `private.get_user_role() = 'advisor'
 *     AND owner_id IN (self + get_advisor_downline_ids(...))` → row-restricted.
 *   - "CRM members can view records"        — `private.is_crm_member(organization_id)`
 *     → whole org (any profile with a crm_role / active organization_members row).
 *   - "Super admins can view all CRM records" — `private.is_super_admin()`.
 * `private.get_user_role()` reads `profiles.role`, i.e. the same column as
 * `profile.role` below. If a policy is added/renamed or another role becomes
 * owner-scoped, update this set in the same change so chip counts keep
 * matching the RLS-scoped list.
 */
const ROW_RESTRICTED_ROLES = new Set(['advisor']);

export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const moduleKey = searchParams.get('module_key')?.trim();
    if (!moduleKey) {
      return NextResponse.json({ error: 'module_key is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const orgId = profile.organization_id;

    const { data: moduleRow, error: moduleError } = await supabase
      .from('crm_modules')
      .select('id, org_id')
      .eq('org_id', orgId)
      .eq('key', moduleKey)
      .maybeSingle();

    if (moduleError || !moduleRow || moduleRow.org_id !== orgId) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'execute_report_aggregation',
      statusValuesRpcArgs(orgId, moduleRow.id),
    );
    if (rpcError) {
      console.error('[status-values] aggregation failed:', rpcError.message);
      return NextResponse.json({ error: 'Failed to load status values' }, { status: 500 });
    }

    const counts = parseStatusValuesRpcResult(rpcData);
    const values = counts.map((v) => ({ ...v, lane: statusLane(v.value) }));
    const byLane = groupStatusValuesByLane(counts);

    const lanes: Array<{ lane: StatusLane; count: number }> = [];
    const rowRestricted = ROW_RESTRICTED_ROLES.has(String(profile.role ?? ''));
    for (const { id: lane } of STATUS_LANES) {
      const laneRows = byLane[lane];
      let count = laneRows.reduce((n, v) => n + v.count, 0);
      if (rowRestricted && laneRows.length > 0) {
        // Re-count under RLS so the chip equals the (RLS-scoped) list.
        const { count: rlsCount, error } = await supabase
          .from('crm_records')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .eq('module_id', moduleRow.id)
          .is('deleted_at' as never, null)
          .in('status', laneRows.map((v) => v.value));
        if (!error && typeof rlsCount === 'number') count = rlsCount;
      }
      lanes.push({ lane, count });
    }

    return NextResponse.json(
      {
        module_key: moduleKey,
        values,
        lanes,
        total: counts.reduce((n, v) => n + v.count, 0),
      },
      { headers: CACHE_HEADERS },
    );
  } catch (err) {
    console.error('[status-values] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
