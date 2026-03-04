import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/crm/advisors/summary
 * Fetch advisor contact summary from the reporting view
 * Supports: ?state=TX&active_only=true
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const state = searchParams.get('state');
    const activeOnly = searchParams.get('active_only') === 'true';

    let query = supabase
      .from('advisor_contact_summary')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('total_contacts', { ascending: false });

    if (state) {
      query = query.eq('state', state);
    }
    if (activeOnly) {
      query = query.eq('advisor_active', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[AdvisorSummary GET]', error);
      return NextResponse.json({ error: 'Failed to fetch advisor summary' }, { status: 500 });
    }

    // Compute org-wide totals
    const totals = (data || []).reduce(
      (acc, row) => ({
        total_contacts: acc.total_contacts + Number(row.total_contacts),
        active_members: acc.active_members + Number(row.active_members),
        inactive_members: acc.inactive_members + Number(row.inactive_members),
        leads: acc.leads + Number(row.leads),
        contacts_this_month: acc.contacts_this_month + Number(row.contacts_this_month),
      }),
      { total_contacts: 0, active_members: 0, inactive_members: 0, leads: 0, contacts_this_month: 0 }
    );

    return NextResponse.json({ data: data || [], totals });
  } catch (error) {
    console.error('[AdvisorSummary GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
