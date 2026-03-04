import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/crm/field-options?field_id=<uuid>
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const fieldId = request.nextUrl.searchParams.get('field_id');
    if (!fieldId) return NextResponse.json({ error: 'Missing field_id' }, { status: 400 });

    const activeOnly = request.nextUrl.searchParams.get('active_only') !== 'false';

    let query = supabase
      .from('crm_field_options')
      .select('*')
      .eq('field_id', fieldId)
      .eq('org_id', profile.organization_id)
      .order('display_order')
      .order('label');

    if (activeOnly) query = query.eq('is_active', true);

    const { data, error } = await query;
    if (error) {
      console.error('[FieldOptions] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch options' }, { status: 500 });
    }

    return NextResponse.json({ options: data || [] });
  } catch (error) {
    console.error('[FieldOptions] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/crm/field-options — create an option
// ---------------------------------------------------------------------------
const createSchema = z.object({
  field_id: z.string().uuid(),
  value: z.string().min(1).max(255),
  label: z.string().min(1).max(255),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  is_default: z.boolean().optional(),
  display_order: z.number().int().optional(),
  metadata: z.record(z.unknown()).optional(),
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
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    const { data, error } = await supabase
      .from('crm_field_options')
      .insert({
        org_id: profile.organization_id,
        ...parsed.data,
        metadata: parsed.data.metadata || {},
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Option value already exists for this field' }, { status: 409 });
      }
      console.error('[FieldOptions] Insert error:', error);
      return NextResponse.json({ error: 'Failed to create option' }, { status: 500 });
    }

    return NextResponse.json({ option: data }, { status: 201 });
  } catch (error) {
    console.error('[FieldOptions] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/crm/field-options — update an option
// ---------------------------------------------------------------------------
const updateSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1).max(255).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  is_default: z.boolean().optional(),
  is_active: z.boolean().optional(),
  display_order: z.number().int().optional(),
  metadata: z.record(z.unknown()).optional(),
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
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    const { id, ...updates } = parsed.data;

    const { data, error } = await supabase
      .from('crm_field_options')
      .update(updates)
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .select()
      .single();

    if (error) {
      console.error('[FieldOptions] Update error:', error);
      return NextResponse.json({ error: 'Failed to update option' }, { status: 500 });
    }

    return NextResponse.json({ option: data });
  } catch (error) {
    console.error('[FieldOptions] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/crm/field-options?id=<uuid>
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
    if (!id) return NextResponse.json({ error: 'Missing option id' }, { status: 400 });

    const { error } = await supabase
      .from('crm_field_options')
      .delete()
      .eq('id', id)
      .eq('org_id', profile.organization_id);

    if (error) {
      console.error('[FieldOptions] Delete error:', error);
      return NextResponse.json({ error: 'Failed to delete option' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[FieldOptions] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/crm/field-options — bulk reorder
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    const body = await request.json();
    const items = z.array(z.object({
      id: z.string().uuid(),
      display_order: z.number().int(),
    })).safeParse(body.items);

    if (!items.success) return NextResponse.json({ error: items.error.errors }, { status: 400 });

    for (const item of items.data) {
      await supabase
        .from('crm_field_options')
        .update({ display_order: item.display_order })
        .eq('id', item.id)
        .eq('org_id', profile.organization_id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[FieldOptions] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
