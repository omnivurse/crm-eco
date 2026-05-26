import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * GET /api/crm/contact-groups/[id]/members
 * List contacts in a group with pagination
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get member record IDs for this group
    const { data: members, count, error } = await supabase
      .from('crm_contact_group_members')
      .select('record_id, added_by, added_at', { count: 'exact' })
      .eq('group_id', id)
      .eq('organization_id', profile.organization_id)
      .order('added_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[GroupMembers GET]', error);
      return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
    }

    if (!members || members.length === 0) {
      return NextResponse.json({ data: [], records: [], total: 0 });
    }

    // Fetch the actual records for these member IDs (org-scoped; RLS also applies)
    // contact_type is not a real column on crm_records — it lives in the
    // JSONB `data` blob (e.g. data->>'contact_type'). Select `data` so the
    // caller can read it from there if they need it.
    const recordIds = members.map((m) => m.record_id);
    const { data: records, error: recError } = await supabase
      .from('crm_records')
      .select('id, title, email, phone, status, data, advisor_id, created_at')
      .in('id', recordIds)
      .eq('org_id', profile.organization_id);

    if (recError) {
      console.error('[GroupMembers GET records]', recError);
    }

    return NextResponse.json({
      data: members,
      records: records || [],
      total: count || 0,
    });
  } catch (error) {
    console.error('[GroupMembers GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const addMembersSchema = z.object({
  record_ids: z.array(z.string().uuid()).min(1).max(500),
});

/**
 * POST /api/crm/contact-groups/[id]/members
 * Add contacts to a group (bulk)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['crm_admin', 'crm_manager', 'crm_agent'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = addMembersSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const supabase = await createClient();

    // Verify group exists in this org
    const { data: group } = await supabase
      .from('crm_contact_groups')
      .select('id')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const { data: contactModules } = await supabase
      .from('crm_modules')
      .select('id')
      .eq('org_id', profile.organization_id)
      .in('key', ['contacts', 'members']);

    const contactModuleIds = (contactModules || []).map((m) => m.id).filter(Boolean);
    if (contactModuleIds.length === 0) {
      return NextResponse.json({ error: 'Contacts module not found' }, { status: 400 });
    }

    const { data: validRecords } = await supabase
      .from('crm_records')
      .select('id')
      .in('id', parsed.data.record_ids)
      .eq('org_id', profile.organization_id)
      .in('module_id', contactModuleIds);

    const allowed = new Set((validRecords || []).map((r) => r.id));
    const rejected = parsed.data.record_ids.filter((rid) => !allowed.has(rid));
    if (rejected.length > 0) {
      return NextResponse.json(
        {
          error: 'Records must be contacts in your organization',
          invalid_record_ids: rejected,
        },
        { status: 400 }
      );
    }

    const rows = parsed.data.record_ids.map((record_id) => ({
      group_id: id,
      record_id,
      organization_id: profile.organization_id,
      added_by: profile.id,
    }));

    const { data, error } = await supabase
      .from('crm_contact_group_members')
      .upsert(rows, { onConflict: 'group_id,record_id', ignoreDuplicates: true })
      .select();

    if (error) {
      console.error('[GroupMembers POST]', error);
      return NextResponse.json({ error: 'Failed to add members' }, { status: 500 });
    }

    return NextResponse.json({ data: data || [], added: (data || []).length }, { status: 201 });
  } catch (error) {
    console.error('[GroupMembers POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const removeMembersSchema = z.object({
  record_ids: z.array(z.string().uuid()).min(1).max(500),
});

/**
 * DELETE /api/crm/contact-groups/[id]/members
 * Remove contacts from a group (bulk)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['crm_admin', 'crm_manager', 'crm_agent'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = removeMembersSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from('crm_contact_group_members')
      .delete()
      .eq('group_id', id)
      .eq('organization_id', profile.organization_id)
      .in('record_id', parsed.data.record_ids);

    if (error) {
      console.error('[GroupMembers DELETE]', error);
      return NextResponse.json({ error: 'Failed to remove members' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[GroupMembers DELETE]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
