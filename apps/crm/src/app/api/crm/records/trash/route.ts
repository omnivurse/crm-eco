import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { parseCrmRecordPageSize } from '@/lib/crm/record-list-constants';

/**
 * GET /api/crm/records/trash?module_key=&page=&page_size=
 *
 * Lists trashed (soft-deleted) records for the Recycle Bin. Admin/manager only.
 * `deleted_at IS NOT NULL`, org-scoped, newest-trashed first, optional module filter.
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const moduleKey = searchParams.get('module_key');
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const pageSize = parseCrmRecordPageSize(searchParams.get('page_size'));

    let moduleId: string | null = null;
    if (moduleKey) {
      const { data: mod } = await supabase
        .from('crm_modules')
        .select('id')
        .eq('org_id', profile.organization_id)
        .eq('key', moduleKey)
        .maybeSingle();
      if (!mod) {
        return NextResponse.json({ error: 'Module not found' }, { status: 404 });
      }
      moduleId = (mod as { id: string }).id;
    }

    let query = (supabase as any)
      .from('crm_records')
      .select(
        'id, title, email, phone, status, module_id, data, deleted_at, deleted_by, delete_batch_id, deleted_origin',
        { count: 'exact' },
      )
      .eq('org_id', profile.organization_id)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });

    if (moduleId) {
      query = query.eq('module_id', moduleId);
    }

    const from = (page - 1) * pageSize;
    query = query.range(from, from + pageSize - 1);

    const { data, count, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      records: data || [],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
