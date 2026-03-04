import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/crm/lifecycle/[contactId]
 * Fetch lifecycle summary and event history for a single contact
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contactId } = await params;
    const supabase = await createClient();

    // Fetch summary from the view
    const { data: summary } = await supabase
      .from('member_history_summary')
      .select('*')
      .eq('contact_id', contactId)
      .eq('organization_id', profile.organization_id)
      .single();

    // Fetch full event history
    const { data: events, error } = await supabase
      .from('member_lifecycle_events')
      .select('*')
      .eq('contact_id', contactId)
      .eq('organization_id', profile.organization_id)
      .order('event_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Lifecycle contactId GET]', error);
      return NextResponse.json({ error: 'Failed to fetch lifecycle' }, { status: 500 });
    }

    return NextResponse.json({
      summary: summary || null,
      events: events || [],
    });
  } catch (error) {
    console.error('[Lifecycle contactId GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
