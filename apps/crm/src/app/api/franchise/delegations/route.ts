import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/franchise/delegations
 *
 * Returns all delegations for the current user's org.
 * Shows delegations the org has granted (as parent) or received (as child).
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
    const direction = request.nextUrl.searchParams.get('direction') || 'granted';

    const orgField = direction === 'received' ? 'child_org_id' : 'parent_org_id';

    const { data, error } = await supabase
      .from('org_delegations')
      .select('*')
      .eq(orgField, profile.organization_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ delegations: data || [] });
  } catch (error) {
    console.error('Error fetching delegations:', error);
    return NextResponse.json({ error: 'Failed to fetch delegations' }, { status: 500 });
  }
}

/**
 * POST /api/franchise/delegations
 *
 * Create or update a delegation for a child org.
 * Owner only. Automatically links to existing relationship.
 * Body: { child_org_id, delegated_role, permissions? }
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['owner', 'super_admin'].includes(profile.role || '')) {
      return NextResponse.json({ error: 'Only org owners can create delegations' }, { status: 403 });
    }

    const body = await request.json();
    const supabase = await createClient();

    if (!body.child_org_id || !body.delegated_role) {
      return NextResponse.json({ error: 'child_org_id and delegated_role are required' }, { status: 400 });
    }

    // Block raw record access
    if (body.permissions?.view_raw_records === true) {
      return NextResponse.json({ error: 'Raw record access cannot be granted via delegation' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('org_delegations')
      .upsert(
        {
          parent_org_id: profile.organization_id,
          child_org_id: body.child_org_id,
          delegated_role: body.delegated_role,
          permissions: body.permissions || {
            view_aggregated_analytics: true,
            view_advisor_roster: false,
            view_commission_totals: true,
            view_enrollment_totals: true,
            view_product_breakdown: true,
            view_monthly_trends: true,
            view_individual_advisors: false,
            view_raw_records: false,
            manage_child_settings: false,
          },
          granted_by: profile.id,
          status: 'active',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'parent_org_id,child_org_id,delegated_role' }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating delegation:', error);
    return NextResponse.json({ error: 'Failed to create delegation' }, { status: 500 });
  }
}
