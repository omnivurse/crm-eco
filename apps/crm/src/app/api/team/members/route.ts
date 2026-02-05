import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/team/members
 * List all team members for the current organization
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();

    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const crmOnly = searchParams.get('crmOnly') === 'true';

    // Get all team members
    let query = supabase
      .from('profiles')
      .select('id, user_id, full_name, email, role, crm_role, status, avatar_url')
      .eq('organization_id', profile.organization_id)
      .order('full_name', { ascending: true });

    if (!includeInactive) {
      query = query.eq('status', 'active');
    }

    if (crmOnly) {
      query = query.not('crm_role', 'is', null);
    }

    const { data: members, error } = await query;

    if (error) {
      console.error('Error fetching team members:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(members || []);
  } catch (error) {
    console.error('Error in GET /api/team/members:', error);
    return NextResponse.json({ error: 'Failed to fetch team members' }, { status: 500 });
  }
}
