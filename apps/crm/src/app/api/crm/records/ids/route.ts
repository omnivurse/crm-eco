/**
 * GET /api/crm/records/ids
 *
 * Returns ONLY the ids of records in a given module that match the current
 * list-page filter/search/scope/advisor state. Used by the "Select all N"
 * affordance in the mass-actions bar so we can apply bulk actions across
 * pagination boundaries without pulling full rows.
 *
 * Query params mirror the list endpoint (`/api/crm/records`):
 *   module_key, search, scope (all|mine|downline), advisor_id,
 *   include_downline, contact_type, group_id
 *
 * Response: { ids: string[], total: number, capped: boolean }
 *
 * Hard capped at 5,000 IDs per request. The `capped` flag tells the client
 * that more records matched but were truncated, so it can surface a warning
 * like "Selected the first 5,000 of 12,400 matches".
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { applyCrmRecordTextSearch } from '@/lib/crm/record-search';

export const dynamic = 'force-dynamic';

const HARD_CAP = 5000;

export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const moduleKey = searchParams.get('module_key');
    if (!moduleKey) {
      return NextResponse.json(
        { error: 'module_key is required' },
        { status: 400 },
      );
    }

    const { data: moduleRow, error: moduleError } = await supabase
      .from('crm_modules')
      .select('id, org_id')
      .eq('key', moduleKey)
      .single();

    if (
      moduleError ||
      !moduleRow ||
      moduleRow.org_id !== profile.organization_id
    ) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    const search = searchParams.get('search');
    const advisorId = searchParams.get('advisor_id');
    const includeDownline = searchParams.get('include_downline') === 'true';
    const contactType = searchParams.get('contact_type');
    const groupId = searchParams.get('group_id');

    let query = supabase
      .from('crm_records')
      .select('id', { count: 'exact' })
      .eq('module_id', moduleRow.id)
      .eq('org_id', profile.organization_id);

    if (groupId) {
      const { data: members } = await supabase
        .from('crm_contact_group_members')
        .select('record_id')
        .eq('group_id', groupId)
        .eq('organization_id', profile.organization_id);
      const memberIds = (members || []).map((m) => m.record_id);
      if (memberIds.length === 0) {
        return NextResponse.json({ ids: [], total: 0, capped: false });
      }
      query = query.in('id', memberIds);
    }

    if (advisorId) {
      if (includeDownline) {
        const { data: downlineIds } = await supabase.rpc(
          'get_advisor_downline_ids',
          { p_advisor_id: advisorId },
        );
        const allIds = [
          advisorId,
          ...((downlineIds || []) as Array<{ id?: string } | string>).map(
            (r) => (typeof r === 'string' ? r : r.id),
          ),
        ].filter(Boolean) as string[];
        query = query.in('advisor_id', allIds);
      } else {
        query = query.eq('advisor_id', advisorId);
      }
    }

    if (contactType) {
      query = query.eq('contact_type', contactType);
    }

    if (search) {
      query = applyCrmRecordTextSearch(query, search);
    }

    query = query.order('created_at', { ascending: false }).range(0, HARD_CAP - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error('[records/ids] query failed:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
    const total = count ?? ids.length;

    return NextResponse.json({
      ids,
      total,
      capped: total > ids.length,
    });
  } catch (error) {
    console.error('[records/ids] unhandled:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
