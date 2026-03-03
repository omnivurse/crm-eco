import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/franchise/children
 *
 * Returns child orgs for the current user's org (parent).
 * Only returns active relationships.
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['owner', 'super_admin', 'admin'].includes(profile.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const supabase = await createClient();
    const params = request.nextUrl.searchParams;
    const status = params.get('status') || 'active';

    let query = supabase
      .from('org_relationships')
      .select(`
        id,
        child_org_id,
        relationship_type,
        status,
        created_at,
        child_org:organizations!org_relationships_child_org_id_fkey(id, name, slug)
      `)
      .eq('parent_org_id', profile.organization_id);

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ children: data || [] });
  } catch (error) {
    console.error('Error fetching franchise children:', error);
    return NextResponse.json({ error: 'Failed to fetch franchise children' }, { status: 500 });
  }
}

/**
 * POST /api/franchise/children
 *
 * Create a franchise relationship + default delegation.
 * Body: { child_org_id, relationship_type? }
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['owner', 'super_admin'].includes(profile.role || '')) {
      return NextResponse.json({ error: 'Only org owners can create franchise relationships' }, { status: 403 });
    }

    const body = await request.json();
    const supabase = await createClient();

    if (!body.child_org_id) {
      return NextResponse.json({ error: 'child_org_id is required' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('create_franchise_relationship', {
      p_parent_org_id: profile.organization_id,
      p_child_org_id: body.child_org_id,
      p_relationship_type: body.relationship_type || 'franchise',
      p_granted_by: profile.id,
    });

    if (error) {
      if (error.message?.includes('CIRCULAR_REF')) {
        return NextResponse.json({ error: 'Cannot create circular relationship' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating franchise relationship:', error);
    return NextResponse.json({ error: 'Failed to create franchise relationship' }, { status: 500 });
  }
}
