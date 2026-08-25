import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/crm/security/roles — list roles with permission counts
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: roles, error } = await supabase
      .from('crm_roles')
      .select('*, crm_role_permissions(id)')
      .or(`organization_id.eq.${profile.organization_id},organization_id.is.null`)
      .order('is_system', { ascending: false })
      .order('name');

    if (error) {
      console.error('[Security/Roles] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
    }

    const result = (roles || []).map((r: any) => ({
      ...r,
      permission_count: r.crm_role_permissions?.length || 0,
      crm_role_permissions: undefined,
    }));

    return NextResponse.json({ roles: result });
  } catch (error) {
    console.error('[Security/Roles] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/crm/security/roles — create a custom role
// ---------------------------------------------------------------------------
const createRoleSchema = z.object({
  key: z.string().min(1).max(50).regex(/^[a-z_]+$/),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  permission_ids: z.array(z.string().uuid()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createRoleSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    const { key, name, description, permission_ids } = parsed.data;

    // Create the role
    const { data: role, error } = await supabase
      .from('crm_roles')
      .insert({
        organization_id: profile.organization_id,
        key,
        name,
        description,
        is_system: false,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Role key already exists' }, { status: 409 });
      }
      console.error('[Security/Roles] Insert error:', error);
      return NextResponse.json({ error: 'Failed to create role' }, { status: 500 });
    }

    // Assign permissions if provided
    if (permission_ids && permission_ids.length > 0) {
      const mappings = permission_ids.map((pid) => ({
        role_id: role.id,
        permission_id: pid,
      }));
      await supabase.from('crm_role_permissions').insert(mappings);
    }

    return NextResponse.json({ role }, { status: 201 });
  } catch (error) {
    console.error('[Security/Roles] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/crm/security/roles — update a role
// ---------------------------------------------------------------------------
const updateRoleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  permission_ids: z.array(z.string().uuid()).optional(),
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
    const parsed = updateRoleSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    const { id, name, description, permission_ids } = parsed.data;

    // Update role fields
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from('crm_roles')
        .update(updates)
        .eq('id', id)
        .or(`organization_id.eq.${profile.organization_id},organization_id.is.null`);
      if (error) {
        console.error('[Security/Roles] Update error:', error);
        return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
      }
    }

    // Sync permissions if provided (replace all)
    if (permission_ids !== undefined) {
      await supabase.from('crm_role_permissions').delete().eq('role_id', id);
      if (permission_ids.length > 0) {
        const mappings = permission_ids.map((pid) => ({
          role_id: id,
          permission_id: pid,
        }));
        await supabase.from('crm_role_permissions').insert(mappings);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Security/Roles] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/crm/security/roles?id=<uuid>
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
    if (!id) return NextResponse.json({ error: 'Missing role id' }, { status: 400 });

    // Prevent deleting system roles
    const { data: role } = await supabase
      .from('crm_roles')
      .select('is_system')
      .eq('id', id)
      .single();

    if (role?.is_system) {
      return NextResponse.json({ error: 'Cannot delete system roles' }, { status: 403 });
    }

    const { error } = await supabase.from('crm_roles').delete().eq('id', id);
    if (error) {
      console.error('[Security/Roles] Delete error:', error);
      return NextResponse.json({ error: 'Failed to delete role' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Security/Roles] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
