import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agencies/[agencyId]
 *
 * Returns a single agency with member count.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agencyId: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { agencyId } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('agencies')
      .select('*')
      .eq('id', agencyId)
      .eq('organization_id', profile.organization_id)
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: 'Agency not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching agency:', error);
    return NextResponse.json({ error: 'Failed to fetch agency' }, { status: 500 });
  }
}

/**
 * PATCH /api/agencies/[agencyId]
 *
 * Update agency details. Admin or agency owner only.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ agencyId: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { agencyId } = await params;
    const body = await request.json();
    const supabase = await createClient();

    const allowedFields = [
      'name', 'code', 'status', 'logo_url', 'primary_color', 'secondary_color',
      'header_bg_color', 'header_text_color', 'company_name', 'website_url',
      'phone', 'email', 'address', 'settings',
    ];

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const field of allowedFields) {
      if (field in body) updates[field] = body[field];
    }

    const { data, error } = await supabase
      .from('agencies')
      .update(updates)
      .eq('id', agencyId)
      .eq('organization_id', profile.organization_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating agency:', error);
    return NextResponse.json({ error: 'Failed to update agency' }, { status: 500 });
  }
}
