import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

// GET /api/campaigns - List campaigns
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('email_campaigns')
      .select('*', { count: 'exact' })
      .eq('org_id', profile.organization_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, count, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      campaigns: data,
      total: count,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
  }
}

// POST /api/campaigns - Create campaign
export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const body = await request.json();

    // Create campaign
    const { data: campaign, error } = await supabase
      .from('email_campaigns')
      .insert({
        org_id: profile.organization_id,
        name: body.name,
        subject: body.subject,
        body_html: body.body_html,
        body_text: body.body_text || null,
        from_name: body.from_name || null,
        from_email: body.from_email,
        reply_to: body.reply_to || null,
        status: body.status || 'draft',
        scheduled_at: body.scheduled_at || null,
        total_recipients: body.total_recipients || 0,
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    console.error('Error creating campaign:', error);
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
  }
}
