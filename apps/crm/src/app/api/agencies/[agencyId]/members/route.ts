import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agencies/[agencyId]/members
 *
 * Returns members of an agency with advisor details.
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

    const { data, error } = await supabase.rpc('get_agency_members', {
      p_agency_id: agencyId,
    });

    if (error) throw error;

    return NextResponse.json({ members: data || [] });
  } catch (error) {
    console.error('Error fetching agency members:', error);
    return NextResponse.json({ error: 'Failed to fetch agency members' }, { status: 500 });
  }
}

/**
 * POST /api/agencies/[agencyId]/members
 *
 * Add a member to an agency. Admin or agency owner/admin only.
 * Body: { advisor_id, role? }
 */
export async function POST(
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

    if (!body.advisor_id) {
      return NextResponse.json({ error: 'advisor_id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('agency_users')
      .insert({
        agency_id: agencyId,
        advisor_id: body.advisor_id,
        role: body.role || 'member',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error adding agency member:', error);
    return NextResponse.json({ error: 'Failed to add agency member' }, { status: 500 });
  }
}
