/**
 * GET /api/crm/debug/idempotency-receipts
 *
 * Lists server-side idempotency ledger rows for the caller's org so
 * the `/crm/debug/offline` inspector can reconcile client-logged
 * receipts against what actually hit the database.
 *
 * Access: restricted to `crm_admin` / `crm_manager`. Support folks
 * triaging a field-rep's device need to see which mutations the server
 * actually persisted — but this is clearly a privileged diagnostic
 * surface and not something regular users should poke at.
 *
 * Query params:
 *   - `since` (ISO timestamp) — only rows created after this time.
 *     Defaults to the last 24h if omitted, matching the ledger TTL.
 *   - `limit` (integer, <= 500) — cap on returned rows. Defaults to
 *     200 which is enough for a day of field work.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthProfile, createClient } from '@/lib/supabase-server';

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (
      !profile.crm_role ||
      !['crm_admin', 'crm_manager'].includes(profile.crm_role)
    ) {
      return NextResponse.json(
        { error: 'Forbidden — requires admin or manager role' },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const sinceRaw = searchParams.get('since');
    const limitRaw = searchParams.get('limit');

    // Fall back to the ledger's default TTL window — 24h — when the
    // caller doesn't narrow it further. That matches how long rows
    // actually live, so the response never misleads the inspector
    // into thinking the server "forgot" something that was simply GC'd.
    const since = sinceRaw
      ? new Date(sinceRaw)
      : new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (Number.isNaN(since.getTime())) {
      return NextResponse.json(
        { error: 'Invalid `since` timestamp' },
        { status: 400 },
      );
    }

    let limit = Number.parseInt(limitRaw ?? '', 10);
    if (!Number.isFinite(limit) || limit <= 0) limit = DEFAULT_LIMIT;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;

    const supabase = await createClient();
    // RLS on `crm_idempotency_keys` already restricts SELECT to the
    // caller's org, but we also pass the org_id filter explicitly for
    // belt-and-braces safety when the table is viewed via a migration
    // where RLS might have been temporarily disabled.
    const { data, error } = await supabase
      .from('crm_idempotency_keys')
      .select(
        'id, key, method, path, status_code, created_at, expires_at, trace_id',
      )
      .eq('organization_id', profile.organization_id)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[idempotency-receipts] query failed', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      receipts: data ?? [],
      since: since.toISOString(),
      limit,
    });
  } catch (error) {
    console.error('[idempotency-receipts] unhandled', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
