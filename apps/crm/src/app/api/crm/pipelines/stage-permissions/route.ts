import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/crm/pipelines/stage-permissions?stage_id=<uuid>
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const stageId = request.nextUrl.searchParams.get('stage_id');
    if (!stageId) {
      return NextResponse.json({ error: 'Missing stage_id' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('crm_stage_permissions')
      .select('*')
      .eq('stage_id', stageId)
      .eq('organization_id', profile.organization_id)
      .order('role', { ascending: true });

    if (error) {
      console.error('[StagePermissions] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch permissions' }, { status: 500 });
    }

    return NextResponse.json({ permissions: data || [] });
  } catch (error) {
    console.error('[StagePermissions] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/crm/pipelines/stage-permissions — create a permission
// ---------------------------------------------------------------------------
const createPermSchema = z.object({
  stage_id: z.string().uuid(),
  role: z.string().max(50).optional().nullable(),
  user_id: z.string().uuid().optional().nullable(),
  can_enter: z.boolean().optional(),
  can_exit: z.boolean().optional(),
  can_edit: z.boolean().optional(),
  can_delete: z.boolean().optional(),
}).refine(
  (d) => d.role != null || d.user_id != null,
  { message: 'Either role or user_id must be provided' }
);

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createPermSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    // Verify stage belongs to this org
    const { data: stage } = await supabase
      .from('crm_pipeline_stages')
      .select('id')
      .eq('id', parsed.data.stage_id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!stage) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('crm_stage_permissions')
      .insert({
        ...parsed.data,
        organization_id: profile.organization_id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Permission already exists for this role/user on this stage' }, { status: 409 });
      }
      console.error('[StagePermissions] Insert error:', error);
      return NextResponse.json({ error: 'Failed to create permission' }, { status: 500 });
    }

    return NextResponse.json({ permission: data }, { status: 201 });
  } catch (error) {
    console.error('[StagePermissions] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/crm/pipelines/stage-permissions — update a permission
// ---------------------------------------------------------------------------
const updatePermSchema = z.object({
  id: z.string().uuid(),
  can_enter: z.boolean().optional(),
  can_exit: z.boolean().optional(),
  can_edit: z.boolean().optional(),
  can_delete: z.boolean().optional(),
});

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updatePermSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    const { id, ...updates } = parsed.data;

    const { data, error } = await supabase
      .from('crm_stage_permissions')
      .update(updates)
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .select()
      .single();

    if (error) {
      console.error('[StagePermissions] Update error:', error);
      return NextResponse.json({ error: 'Failed to update permission' }, { status: 500 });
    }

    return NextResponse.json({ permission: data });
  } catch (error) {
    console.error('[StagePermissions] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/crm/pipelines/stage-permissions?id=<uuid>
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing permission id' }, { status: 400 });

    const { error } = await supabase
      .from('crm_stage_permissions')
      .delete()
      .eq('id', id)
      .eq('organization_id', profile.organization_id);

    if (error) {
      console.error('[StagePermissions] Delete error:', error);
      return NextResponse.json({ error: 'Failed to delete permission' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[StagePermissions] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
