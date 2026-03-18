import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/crm/carriers/[id]
 * Fetch a single carrier by ID
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('insurance_carriers')
      .select('*')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Carrier not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/crm/carriers/[id]
 * Update a carrier (admin/manager only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const supabase = await createClient();

    // Only allow safe fields to be updated
    const allowedFields = ['carrier_name', 'naic_code', 'website', 'logo_url', 'carrier_type', 'phone', 'email', 'is_active', 'metadata'];
    const updateData: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (body[key] !== undefined) updateData[key] = body[key];
    }

    const { data, error } = await supabase
      .from('insurance_carriers')
      .update(updateData)
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/crm/carriers/[id]
 * Archive a carrier (set is_active = false) rather than hard delete.
 * Hard delete only for admin role.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const hard = searchParams.get('hard') === 'true';

    if (hard && profile.crm_role === 'crm_admin') {
      // Hard delete (admin only)
      const { error } = await supabase
        .from('insurance_carriers')
        .delete()
        .eq('id', id)
        .eq('organization_id', profile.organization_id);

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ deleted: true });
    }

    // Soft delete (archive)
    const { data, error } = await supabase
      .from('insurance_carriers')
      .update({ is_active: false })
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ archived: true, carrier: data });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
