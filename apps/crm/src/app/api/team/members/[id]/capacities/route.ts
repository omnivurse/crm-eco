import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

// PATCH /api/team/members/[id]/capacities - Update advisor capacities
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins+ can update capacities
    if (!['owner', 'super_admin', 'admin'].includes(profile.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id: memberId } = await params;
    const body = await request.json();
    const { capacities } = body;

    if (!Array.isArray(capacities)) {
      return NextResponse.json({ error: 'capacities must be an array' }, { status: 400 });
    }

    // Validate capacity values
    const validCapacities = ['health_insurance', 'health_share'];
    const filtered = capacities.filter((c: string) => validCapacities.includes(c));

    const supabase = await createClient();

    // Find the advisor linked to this profile
    const { data: advisor, error: advisorError } = await supabase
      .from('advisors')
      .select('id')
      .eq('profile_id', memberId)
      .eq('organization_id', profile.organization_id)
      .single();

    if (advisorError || !advisor) {
      // If no advisor record, try to update the profile's capacity_preferences instead
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ capacity_preferences: filtered })
        .eq('id', memberId)
        .eq('organization_id', profile.organization_id);

      if (profileError) throw profileError;

      return NextResponse.json({ capacities: filtered, source: 'profile' });
    }

    // Update the advisor's capacities
    const { error: updateError } = await supabase
      .from('advisors')
      .update({ capacities: filtered })
      .eq('id', advisor.id)
      .eq('organization_id', profile.organization_id);

    if (updateError) throw updateError;

    return NextResponse.json({ capacities: filtered, source: 'advisor' });
  } catch (error) {
    console.error('Error updating capacities:', error);
    return NextResponse.json({ error: 'Failed to update capacities' }, { status: 500 });
  }
}

// GET /api/team/members/[id]/capacities - Get advisor capacities
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: memberId } = await params;
    const supabase = await createClient();

    // Try advisor first
    const { data: advisor } = await supabase
      .from('advisors')
      .select('capacities')
      .eq('profile_id', memberId)
      .eq('organization_id', profile.organization_id)
      .single();

    if (advisor) {
      return NextResponse.json({ capacities: advisor.capacities || [], source: 'advisor' });
    }

    // Fall back to profile preferences
    const { data: profileData } = await supabase
      .from('profiles')
      .select('capacity_preferences')
      .eq('id', memberId)
      .eq('organization_id', profile.organization_id)
      .single();

    return NextResponse.json({
      capacities: profileData?.capacity_preferences || [],
      source: 'profile',
    });
  } catch (error) {
    console.error('Error fetching capacities:', error);
    return NextResponse.json({ error: 'Failed to fetch capacities' }, { status: 500 });
  }
}
