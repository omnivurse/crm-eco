/**
 * GET /api/crm/records/field-values?module_key=contacts&key=health_insurance_plan_name[&limit=25]
 *
 * Top distinct stored values (+ counts) of ONE JSONB field (`crm_records.data->>key`)
 * for ONE module of the caller's org. Feeds free-text suggestions — first use is
 * the Health Insurance Plan field on the Quick Create drawer (Road to Ten DE-2).
 * Nothing is rewritten: spellings come back exactly as stored, most-used first.
 *
 * Response:
 *   {
 *     module_key: string,
 *     key: string,
 *     values: Array<{ value: string; count: number }>,   // count desc, then value asc
 *     total: number,                                    // sum of the returned counts
 *   }
 *
 * Errors: 401 unauthenticated · 400 missing/invalid `module_key`/`key`/`limit`
 * or `key` is not a crm_fields key of that module (allowlist) · 404 module not
 * in the caller's org · 500 RPC failure.
 *
 * Counting: one `crm_field_distinct_values` RPC (SECURITY INVOKER, STABLE —
 * supabase/migrations/20260823010000_crm_field_distinct_values_rpc.sql). It
 * runs under the caller's own crm_records RLS, so row-restricted roles
 * (advisor → downline-only) only ever see values from rows they can list;
 * no re-count step is needed (contrast records/status-values). Module and
 * field lookups are pinned to `profile.organization_id`, and the RPC's
 * module_id belongs to exactly one org, so another tenant's values are
 * unreachable even with a guessed key.
 *
 * Caching: `Cache-Control: private, max-age=60` (per browser, per user) —
 * suggestions may lag a new spelling by a minute at most.
 *
 * Helpers + response type live in lib/crm/field-values.ts (route modules may
 * only export handlers/config under Next's route validator).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import {
  FIELD_KEY_PATTERN,
  MAX_LIMIT,
  parseFieldValuesRpcResult,
  parseLimit,
  type FieldValuesResponse,
} from '@/lib/crm/field-values';

export const dynamic = 'force-dynamic';

const CACHE_HEADERS = { 'Cache-Control': 'private, max-age=60' };

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
    const key = searchParams.get('key')?.trim() ?? '';
    if (!FIELD_KEY_PATTERN.test(key)) {
      return NextResponse.json(
        { error: 'key is required and must match ^[a-z0-9_]{1,64}$' },
        { status: 400 },
      );
    }
    const limit = parseLimit(searchParams.get('limit'));
    if (limit === null) {
      return NextResponse.json({ error: `limit must be an integer 1..${MAX_LIMIT}` }, { status: 400 });
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

    // Allowlist: only keys defined as fields of THIS module (same org) may be queried.
    const { data: fieldRow, error: fieldError } = await supabase
      .from('crm_fields')
      .select('id')
      .eq('org_id', orgId)
      .eq('module_id', moduleRow.id)
      .eq('key', key)
      .maybeSingle();

    if (fieldError) {
      console.error('[field-values] field lookup failed:', fieldError.message);
      return NextResponse.json({ error: 'Failed to load field values' }, { status: 500 });
    }
    if (!fieldRow) {
      return NextResponse.json({ error: 'key is not a field of this module' }, { status: 400 });
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc('crm_field_distinct_values', {
      p_module_id: moduleRow.id,
      p_key: key,
      p_limit: limit,
    });
    if (rpcError) {
      console.error('[field-values] aggregation failed:', rpcError.message);
      return NextResponse.json({ error: 'Failed to load field values' }, { status: 500 });
    }

    const values = parseFieldValuesRpcResult(rpcData);

    const body: FieldValuesResponse = {
      module_key: moduleKey,
      key,
      values,
      total: values.reduce((n, v) => n + v.count, 0),
    };
    return NextResponse.json(body, { headers: CACHE_HEADERS });
  } catch (err) {
    console.error('[field-values] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
