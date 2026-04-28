/**
 * Per-user "recently viewed" log for CRM records.
 *
 *   GET  /api/crm/recently-viewed?module_key=contacts&limit=12
 *        → list recent records (optionally scoped to a module).
 *   POST /api/crm/recently-viewed
 *        body: { recordId: uuid }
 *        → upsert (user_id, record_id); bumps last_viewed_at + view_count.
 *
 * Used by:
 *   - `useRecentlyViewedTracker()` on record detail pages to log visits.
 *   - `RecentlyViewedRail` on list/module pages to surface the last N.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createClient,
  getAuthProfile,
  getAuthUser,
} from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
/** Avoid Edge/runtime quirks on hosts where API routes otherwise 404 or mis-route. */
export const runtime = 'nodejs';

interface RecentlyViewedJoinedRow {
  record_id: string;
  module_id: string;
  last_viewed_at: string;
  view_count: number;
  record: {
    id: string;
    title: string | null;
    module_id: string;
    data: Record<string, unknown> | null;
    updated_at: string | null;
  } | null;
  module: {
    key: string;
    name: string;
  } | null;
}

export async function GET(request: NextRequest) {
  const profile = await getAuthProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const moduleKey = searchParams.get('module_key');
  const limit = Math.min(
    Math.max(parseInt(searchParams.get('limit') || '12', 10), 1),
    50,
  );

  let moduleId: string | null = null;
  if (moduleKey) {
    const { data: moduleRow } = await supabase
      .from('crm_modules')
      .select('id')
      .eq('org_id', profile.organization_id)
      .eq('key', moduleKey)
      .maybeSingle();

    // Match /crm/modules/contacts behavior: some orgs only have `members`, not `contacts`.
    let resolved = moduleRow;
    if (!resolved && moduleKey === 'contacts') {
      const { data: membersRow } = await supabase
        .from('crm_modules')
        .select('id')
        .eq('org_id', profile.organization_id)
        .eq('key', 'members')
        .maybeSingle();
      resolved = membersRow ?? null;
    }

    if (!resolved) {
      return NextResponse.json({ data: [] });
    }
    moduleId = resolved.id;
  }

  const { user } = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let query = supabase
    .from('crm_recently_viewed')
    .select(
      `record_id,
       module_id,
       last_viewed_at,
       view_count,
       record:crm_records ( id, title, module_id, data, updated_at ),
       module:crm_modules ( key, name )`,
    )
    .eq('user_id', user.id)
    .eq('organization_id', profile.organization_id)
    .order('last_viewed_at', { ascending: false })
    .limit(limit);
  if (moduleId) {
    query = query.eq('module_id', moduleId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[recently-viewed GET]', error);
    return NextResponse.json(
      { error: 'Failed to load recently viewed' },
      { status: 500 },
    );
  }

  const rows = ((data ?? []) as unknown as RecentlyViewedJoinedRow[])
    .filter((row) => row.record != null)
    .map((row) => ({
      recordId: row.record_id,
      moduleId: row.module_id,
      moduleKey: row.module?.key ?? null,
      moduleName: row.module?.name ?? null,
      title: row.record?.title ?? null,
      data: row.record?.data ?? null,
      lastViewedAt: row.last_viewed_at,
      viewCount: row.view_count,
      updatedAt: row.record?.updated_at ?? null,
    }));

  return NextResponse.json({ data: rows });
}

const postSchema = z.object({
  recordId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const profile = await getAuthProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { user } = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Resolve the record's module so the row is self-describing for the
  // module-scoped rail query. Org scope is enforced by RLS on crm_records.
  const { data: record, error: recordError } = await supabase
    .from('crm_records')
    .select('id, module_id, org_id')
    .eq('id', parsed.data.recordId)
    .maybeSingle();

  if (recordError) {
    return NextResponse.json(
      { error: recordError.message },
      { status: 500 },
    );
  }
  if (!record) {
    return NextResponse.json(
      { error: 'Record not found', code: 'record_not_found' },
      { status: 404 },
    );
  }
  if (record.org_id !== profile.organization_id) {
    return NextResponse.json(
      { error: 'Record is not in your organization', code: 'org_mismatch' },
      { status: 403 },
    );
  }

  // Upsert on (user_id, record_id). We bump last_viewed_at + view_count
  // via a two-step approach: try insert, on conflict update.
  const { error: upsertError } = await supabase
    .from('crm_recently_viewed')
    .upsert(
      {
        organization_id: profile.organization_id,
        user_id: user.id,
        record_id: record.id,
        module_id: record.module_id,
        last_viewed_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,record_id', ignoreDuplicates: false },
    );

  if (upsertError) {
    console.error('[recently-viewed POST upsert]', upsertError);
    return NextResponse.json(
      { error: 'Failed to log view' },
      { status: 500 },
    );
  }

  // Best-effort increment of view_count. Separate RPC-less update since
  // upsert can't express `view_count = view_count + 1` without an RPC.
  // If it fails we still keep the last_viewed_at bump above, so the rail
  // is correct even if the counter is slightly stale.
  await supabase.rpc('increment_recently_viewed_count', {
    _user_id: user.id,
    _record_id: record.id,
  }).then(({ error }) => {
    // Accept missing-function errors silently; the column still gets a
    // value from the INSERT default. A future migration can add the RPC
    // if per-count ordering becomes important.
    if (error && !String(error.message).includes('function')) {
      console.warn('[recently-viewed POST count]', error.message);
    }
  });

  return NextResponse.json({ ok: true });
}
