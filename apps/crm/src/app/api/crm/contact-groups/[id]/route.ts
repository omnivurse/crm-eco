import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * GET /api/crm/contact-groups/[id]
 * Fetch a single group with its member record IDs
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = await createClient();

    const { data: group, error } = await supabase
      .from('crm_contact_groups')
      .select('*')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (error || !group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Fetch member count
    const { count } = await supabase
      .from('crm_contact_group_members')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', id);

    return NextResponse.json({ data: { ...group, member_count: count || 0 } });
  } catch (error) {
    console.error('[ContactGroups GET/:id]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const updateGroupSchema = z.object({
  group_name: z.string().min(1).max(255).optional(),
  group_type: z.enum(['status', 'product', 'source', 'custom']).optional(),
  description: z.string().max(500).nullable().optional(),
  color: z.string().max(20).optional(),
  icon: z.string().max(50).optional(),
  is_active: z.boolean().optional(),
  display_order: z.number().int().min(0).optional(),
});

/**
 * PUT /api/crm/contact-groups/[id]
 * Update a contact group
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updateGroupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('crm_contact_groups')
      .update(parsed.data)
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .select()
      .single();

    if (error) {
      if ((error as any).code === '23505') {
        return NextResponse.json(
          { error: 'A group with this name already exists' },
          { status: 409 }
        );
      }
      console.error('[ContactGroups PUT]', error);
      return NextResponse.json({ error: 'Failed to update group' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('[ContactGroups PUT]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/crm/contact-groups/[id]
 * Delete a contact group (admin only, non-system groups)
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const supabase = await createClient();

    // Check it's not a system group
    const { data: group } = await supabase
      .from('crm_contact_groups')
      .select('is_system')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (group?.is_system) {
      return NextResponse.json(
        { error: 'System groups cannot be deleted' },
        { status: 403 }
      );
    }

    // Soft-delete (move to Trash) so the group can be restored via Undo.
    const { error } = await (supabase as any)
      .from('crm_contact_groups')
      .update({ deleted_at: new Date().toISOString(), deleted_by: profile.id, deleted_origin: 'user' })
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .is('deleted_at', null);

    if (error) {
      console.error('[ContactGroups DELETE]', error);
      return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 });
    }

    return NextResponse.json({ success: true, trashed: true });
  } catch (error) {
    console.error('[ContactGroups DELETE]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
