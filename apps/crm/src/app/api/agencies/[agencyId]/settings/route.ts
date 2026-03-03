import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agencies/[agencyId]/settings
 *
 * Returns agency settings. Org admin or agency owner only.
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
      .from('agency_settings')
      .select('*')
      .eq('agency_id', agencyId)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json(data || { agency_id: agencyId });
  } catch (error) {
    console.error('Error fetching agency settings:', error);
    return NextResponse.json({ error: 'Failed to fetch agency settings' }, { status: 500 });
  }
}

/**
 * PUT /api/agencies/[agencyId]/settings
 *
 * Upsert agency settings. Admin or agency owner only.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ agencyId: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['owner', 'super_admin', 'admin'].includes(profile.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { agencyId } = await params;
    const body = await request.json();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('agency_settings')
      .upsert(
        {
          agency_id: agencyId,
          override_rate: body.override_rate ?? null,
          bonus_threshold: body.bonus_threshold ?? null,
          bonus_rate: body.bonus_rate ?? null,
          require_license_verification: body.require_license_verification ?? false,
          require_appointment_verification: body.require_appointment_verification ?? false,
          auto_terminate_days: body.auto_terminate_days ?? null,
          custom_domain: body.custom_domain ?? null,
          email_from_name: body.email_from_name ?? null,
          email_from_addr: body.email_from_addr ?? null,
          allowed_capacities: body.allowed_capacities ?? [],
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'agency_id' }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating agency settings:', error);
    return NextResponse.json({ error: 'Failed to update agency settings' }, { status: 500 });
  }
}
