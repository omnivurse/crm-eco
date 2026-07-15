import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/crm/carriers/[id]/contacts
 * List all contacts for a carrier.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: carrierId } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('carrier_contacts')
      .select('*')
      .eq('carrier_id', carrierId)
      .eq('organization_id', profile.organization_id)
      .is('deleted_at' as never, null)
      .order('sort_order', { ascending: true })
      .order('contact_role', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data: data || [] });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/crm/carriers/[id]/contacts
 * Add a new contact to a carrier (admin/manager only).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id: carrierId } = await params;
    const body = await request.json();

    const allowedFields = [
      'contact_role', 'label', 'contact_name', 'phone', 'email',
      'agent_id', 'username', 'password', 'secure_email_user', 'secure_email_addr',
      'portal_url', 'custom_link', 'custom_link_label', 'notes',
      'is_primary', 'sort_order',
    ];

    const insertData: Record<string, unknown> = {
      organization_id: profile.organization_id,
      carrier_id: carrierId,
    };
    for (const key of allowedFields) {
      if (body[key] !== undefined) insertData[key] = body[key];
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('carrier_contacts')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/crm/carriers/[id]/contacts
 * Update a contact. Body must include `contact_id`.
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

    const { id: carrierId } = await params;
    const body = await request.json();
    const contactId = body.contact_id;
    if (!contactId) {
      return NextResponse.json({ error: 'contact_id is required' }, { status: 400 });
    }

    const allowedFields = [
      'contact_role', 'label', 'contact_name', 'phone', 'email',
      'agent_id', 'username', 'password', 'secure_email_user', 'secure_email_addr',
      'portal_url', 'custom_link', 'custom_link_label', 'notes',
      'is_primary', 'sort_order',
    ];

    const updateData: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (body[key] !== undefined) updateData[key] = body[key];
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('carrier_contacts')
      .update(updateData)
      .eq('id', contactId)
      .eq('carrier_id', carrierId)
      .eq('organization_id', profile.organization_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/crm/carriers/[id]/contacts?contact_id=...
 * Remove a contact (admin only).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id: carrierId } = await params;
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contact_id');
    if (!contactId) {
      return NextResponse.json({ error: 'contact_id query param required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Soft-delete (move to Trash) so deleted carrier credentials can be restored
    // via Undo rather than being irrecoverably destroyed by a mis-click.
    const { error } = await (supabase as any)
      .from('carrier_contacts')
      .update({ deleted_at: new Date().toISOString(), deleted_by: profile.id, deleted_origin: 'user' })
      .eq('id', contactId)
      .eq('carrier_id', carrierId)
      .eq('organization_id', profile.organization_id)
      .is('deleted_at', null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ deleted: true, trashed: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
