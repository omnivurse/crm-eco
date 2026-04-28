import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthUser, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';
import { executeCrmRecordCreate } from '@/lib/crm/record-create-service';
import { applyCrmRecordTextSearch } from '@/lib/crm/record-search';
import { parseCrmRecordPageSize } from '@/lib/crm/record-list-constants';

/**
 * GET /api/crm/records
 * Fetch records with pagination, filtering, and search
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();

    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const moduleKey = searchParams.get('module_key');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseCrmRecordPageSize(searchParams.get('page_size'));
    const search = searchParams.get('search');
    const advisorId = searchParams.get('advisor_id');
    const includeDownline = searchParams.get('include_downline') === 'true';
    const contactType = searchParams.get('contact_type');
    const groupId = searchParams.get('group_id');

    if (!moduleKey) {
      return NextResponse.json({ error: 'module_key is required' }, { status: 400 });
    }

    // Fetch module by key
    const { data: module, error: moduleError } = await supabase
      .from('crm_modules')
      .select('id, org_id')
      .eq('key', moduleKey)
      .single();

    // Validate module belongs to user's organization
    if (moduleError || !module || module.org_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    // Build query
    let query = supabase
      .from('crm_records')
      .select('*', { count: 'exact' })
      .eq('module_id', module.id)
      .eq('org_id', profile.organization_id);

    // Apply group filter — fetch record IDs in the group, then filter
    if (groupId) {
      const { data: groupMembers } = await supabase
        .from('crm_contact_group_members')
        .select('record_id')
        .eq('group_id', groupId)
        .eq('organization_id', profile.organization_id);

      const memberIds = (groupMembers || []).map((m) => m.record_id);
      if (memberIds.length === 0) {
        return NextResponse.json({
          records: [],
          total: 0,
          page,
          pageSize,
          totalPages: 0,
        });
      }
      query = query.in('id', memberIds);
    }

    // Apply advisor filter — optionally include downline advisors
    if (advisorId) {
      if (includeDownline) {
        // Fetch all advisor IDs in the hierarchy tree
        const { data: downlineIds } = await supabase.rpc('get_advisor_downline_ids', {
          p_advisor_id: advisorId,
        });
        const allIds = [advisorId, ...(downlineIds || []).map((r: any) => r.id || r)];
        query = query.in('advisor_id', allIds);
      } else {
        query = query.eq('advisor_id', advisorId);
      }
    }

    // Apply contact type filter
    if (contactType) {
      query = query.eq('contact_type', contactType);
    }

    if (search) {
      query = applyCrmRecordTextSearch(query, search);
    }

    // Apply sorting
    query = query.order('created_at', { ascending: false });

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data: records, count, error } = await query;

    if (error) {
      console.error('Error fetching records:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      records: records || [],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    });
  } catch (error) {
    console.error('Error in GET /api/crm/records:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const createRecordSchema = z.object({
  org_id: z.string().uuid(),
  module_id: z.string().uuid(),
  owner_id: z.string().uuid().optional(),
  data: z.record(z.unknown()),
  status: z.string().optional(),
  stage: z.string().optional(),
  force: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user } = await getAuthUser();
    const profile = await getAuthProfile();

    if (!user || !profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createRecordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    if (!['crm_admin', 'crm_manager', 'crm_agent'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const created = await executeCrmRecordCreate({
      supabase,
      profile,
      user,
      input: {
        org_id: parsed.data.org_id,
        module_id: parsed.data.module_id,
        owner_id: parsed.data.owner_id,
        data: parsed.data.data as Record<string, unknown>,
        status: parsed.data.status,
        stage: parsed.data.stage,
        force: parsed.data.force,
      },
    });

    if (!created.ok) {
      return NextResponse.json(created.body, { status: created.status });
    }

    return NextResponse.json(created.record);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
