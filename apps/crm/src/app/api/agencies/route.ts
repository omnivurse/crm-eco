import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agencies
 *
 * Returns agencies visible to the current user.
 * - Org admins: all agencies in org
 * - Agency owners/admins: their own agency
 * - Regular advisors: agencies they belong to
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const params = request.nextUrl.searchParams;
    const status = params.get('status') || 'active';

    let query = supabase
      .from('agencies')
      .select('*, agency_users!inner(advisor_id, role, status)')
      .eq('organization_id', profile.organization_id);

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('name');

    if (error) throw error;

    return NextResponse.json({ agencies: data || [] });
  } catch (error) {
    console.error('Error fetching agencies:', error);
    return NextResponse.json({ error: 'Failed to fetch agencies' }, { status: 500 });
  }
}

/**
 * POST /api/agencies
 *
 * Create a new agency. Admin-only.
 * Body: { name, owner_advisor_id, code?, logo_url?, primary_color?, ... }
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['owner', 'super_admin', 'admin'].includes(profile.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const supabase = await createClient();

    if (!body.name || !body.owner_advisor_id) {
      return NextResponse.json({ error: 'name and owner_advisor_id are required' }, { status: 400 });
    }

    // Create agency
    const { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .insert({
        organization_id: profile.organization_id,
        owner_advisor_id: body.owner_advisor_id,
        name: body.name,
        code: body.code || null,
        logo_url: body.logo_url || null,
        primary_color: body.primary_color || '#1e40af',
        secondary_color: body.secondary_color || '#3b82f6',
        header_bg_color: body.header_bg_color || '#1e3a8a',
        header_text_color: body.header_text_color || '#ffffff',
        company_name: body.company_name || body.name,
        website_url: body.website_url || null,
        phone: body.phone || null,
        email: body.email || null,
      })
      .select()
      .single();

    if (agencyError) throw agencyError;

    // Auto-add owner as agency user
    await supabase.from('agency_users').insert({
      agency_id: agency.id,
      advisor_id: body.owner_advisor_id,
      role: 'owner',
    });

    return NextResponse.json(agency, { status: 201 });
  } catch (error) {
    console.error('Error creating agency:', error);
    return NextResponse.json({ error: 'Failed to create agency' }, { status: 500 });
  }
}
