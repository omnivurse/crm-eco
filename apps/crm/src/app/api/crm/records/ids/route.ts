/**
 * GET /api/crm/records/ids
 *
 * Returns ONLY the ids of records in a module that match the current
 * module-list page state. Used by the "Select all N" affordance in the
 * mass-actions bar so bulk actions can span pagination boundaries without
 * pulling full rows.
 *
 * Query params are the module-list URL, exactly as `buildListQuery` in
 * `app/crm/modules/[moduleKey]/page.tsx` writes them (see
 * `LIST_QUERY_URL_KEYS` in lib/crm/list-query-resolve.ts):
 *   module_key (required), view, filters (JSON ViewFilter[]), search,
 *   scope (all|mine|downline), territory, sortField, sortDirection
 * The saved view → filters resolution and the row predicate are the SAME code
 * the list page runs (`loadListQueryState` + `applyRecordListQuery`), so the
 * returned `total` equals the list's pager total for that URL. `sortField` /
 * `sortDirection` are accepted for parity but do not change the row set.
 *
 * Legacy narrowers from the older contacts API are still honoured when
 * present (advisor_id, include_downline, contact_type, group_id); the list
 * page itself never writes them.
 *
 * Response: { ids: string[], total: number, capped: boolean }
 *
 * Hard capped at 5,000 IDs per request. The `capped` flag tells the client
 * that more records matched but were truncated, so it can surface a warning
 * like "Selected the first 5,000 of 12,400 matches".
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import {
  applyRecordListQuery,
  getCurrentProfile,
  getDefaultView,
  getFieldsForModule,
  getViewsForModule,
} from '@/lib/crm/queries';
import { loadListQueryState, readListUrlQueryState } from '@/lib/crm/list-query-resolve';

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

    // Resolve the module within this org only (keys like `contacts` exist
    // per tenant) — never by key alone.
    const { data: moduleRow, error: moduleError } = await supabase
      .from('crm_modules')
      .select('id, org_id')
      .eq('org_id', profile.organization_id)
      .eq('key', moduleKey)
      .maybeSingle();

    if (
      moduleError ||
      !moduleRow ||
      moduleRow.org_id !== profile.organization_id
    ) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    // Same view → filters/scope/territory resolution as the list page
    // (habit-preferred view included — the page reads it off ui_preferences).
    const crmProfile = await getCurrentProfile();
    const url = readListUrlQueryState(searchParams);
    const [listState, fields] = await Promise.all([
      loadListQueryState({
        moduleKey,
        loadViews: () => getViewsForModule(moduleRow.id),
        loadDefaultView: () => getDefaultView(moduleRow.id),
        uiPreferences: crmProfile?.ui_preferences,
        url,
      }),
      // The page searches every field key of the module (uncapped, in
      // display order) — mirror it so the search predicate is identical.
      getFieldsForModule(moduleRow.id).catch(() => []),
    ]);

    const base = supabase
      .from('crm_records')
      .select('id', { count: 'exact' })
      .eq('module_id', moduleRow.id);

    // ONE predicate builder with the list page: org scope, trash, hide
    // converted leads, territory, scope, system/related/field filters, search.
    let { query } = await applyRecordListQuery(base, {
      moduleId: moduleRow.id,
      orgId: profile.organization_id,
      moduleKey,
      filters: listState.filters,
      search: listState.search,
      searchDataJsonKeys: fields.map((f) => f.key),
      scope: listState.scope,
      territoryId: listState.territoryId,
    });

    // ── Legacy narrowers (older contacts API callers) ──
    const advisorId = searchParams.get('advisor_id');
    const includeDownline = searchParams.get('include_downline') === 'true';
    const contactType = searchParams.get('contact_type');
    const groupId = searchParams.get('group_id');

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

    // Append `id` tiebreaker so the 5,000-row hard-cap returns a reproducible
    // subset when many records share a `created_at` (bulk imports, batch jobs).
    // Without it, "Select All" can quietly include slightly different sets
    // across page loads, breaking bulk operations the user just ran.
    query = query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(0, HARD_CAP - 1);

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
