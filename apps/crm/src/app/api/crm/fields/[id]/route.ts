import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch { }
        },
      },
    }
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, crm_role')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if field is system field
    const { data: field } = await supabase
      .from('crm_fields')
      .select('is_system')
      .eq('id', id)
      .single();

    if (field?.is_system) {
      return NextResponse.json({ error: 'Cannot delete system field' }, { status: 400 });
    }

    const { error } = await supabase
      .from('crm_fields')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, crm_role, organization_id')
      .eq('user_id', user.id)
      .single();

    // Allow managers and admins to pin/unpin fields
    if (!profile || !['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build updates object - only include fields that are provided
    const updates: Record<string, unknown> = {};

    if (body.is_pinned !== undefined) {
      updates.is_pinned = body.is_pinned;
    }
    if (body.label !== undefined) {
      updates.label = body.label;
    }
    if (body.display_order !== undefined) {
      updates.display_order = body.display_order;
    }
    if (body.is_required !== undefined) {
      updates.is_required = body.is_required;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data: field, error } = await supabase
      .from('crm_fields')
      .update(updates)
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .select()
      .single();

    if (error) {
      console.error('Field update error:', error);
      // If it's a column doesn't exist error, return a friendly message
      if (error.message?.includes('column') || error.code === '42703') {
        return NextResponse.json({
          error: 'Field update failed - database schema may need updating',
          success: false
        }, { status: 500 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, field });
  } catch (error) {
    console.error('PATCH /api/crm/fields/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, crm_role, organization_id')
      .eq('user_id', user.id)
      .single();

    // Only admins can fully update fields
    if (!profile || profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if field exists and is not a system field
    const { data: existingField } = await supabase
      .from('crm_fields')
      .select('is_system')
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .single();

    if (!existingField) {
      return NextResponse.json({ error: 'Field not found' }, { status: 404 });
    }

    if (existingField.is_system) {
      return NextResponse.json({ error: 'Cannot modify system field' }, { status: 400 });
    }

    // Allowed update fields
    const { label, required, options, tooltip, section, validation, default_value } = body;

    const updateData: Record<string, unknown> = {};
    if (label !== undefined) updateData.label = label;
    if (required !== undefined) updateData.required = required;
    if (options !== undefined) updateData.options = options;
    if (tooltip !== undefined) updateData.tooltip = tooltip;
    if (section !== undefined) updateData.section = section;
    if (validation !== undefined) updateData.validation = validation;
    if (default_value !== undefined) updateData.default_value = default_value;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data: field, error } = await supabase
      .from('crm_fields')
      .update(updateData)
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(field);
  } catch (error) {
    console.error('PUT /api/crm/fields/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
