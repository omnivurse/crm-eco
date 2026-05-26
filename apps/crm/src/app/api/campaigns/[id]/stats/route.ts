import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

// GET /api/campaigns/[id]/stats - Get campaign statistics
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const { id } = await params;

    // Get campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Get recipient stats
    const { data: recipients } = await supabase
      .from('email_campaign_recipients')
      .select('status, opened_at, clicked_at, bounced_at, unsubscribed_at')
      .eq('campaign_id', id);

    const recipientList = recipients || [];

    // Calculate stats
    const stats = {
      total_recipients: campaign.total_recipients,
      sent: recipientList.filter(r => r.status === 'sent' || r.status === 'delivered' || r.status === 'opened' || r.status === 'clicked').length,
      delivered: recipientList.filter(r => r.status === 'delivered' || r.status === 'opened' || r.status === 'clicked').length,
      opened: recipientList.filter(r => r.opened_at !== null).length,
      clicked: recipientList.filter(r => r.clicked_at !== null).length,
      bounced: recipientList.filter(r => r.bounced_at !== null).length,
      unsubscribed: recipientList.filter(r => r.unsubscribed_at !== null).length,
      pending: recipientList.filter(r => r.status === 'pending').length,
      failed: recipientList.filter(r => r.status === 'failed').length,
    };

    // Calculate rates
    const rates = {
      delivery_rate: stats.sent > 0 ? Math.round((stats.delivered / stats.sent) * 100) : 0,
      open_rate: stats.delivered > 0 ? Math.round((stats.opened / stats.delivered) * 100) : 0,
      click_rate: stats.delivered > 0 ? Math.round((stats.clicked / stats.delivered) * 100) : 0,
      bounce_rate: stats.sent > 0 ? Math.round((stats.bounced / stats.sent) * 100) : 0,
      unsubscribe_rate: stats.delivered > 0 ? Math.round((stats.unsubscribed / stats.delivered) * 100) : 0,
    };

    // Get top clicked links (from tracking events). The URL lives in the
    // dedicated `clicked_url` column.
    const { data: clickEvents } = await supabase
      .from('campaign_tracking_events')
      .select('clicked_url')
      .eq('campaign_id', id)
      .eq('event_type', 'click');

    const linkCounts: Record<string, number> = {};
    (clickEvents || []).forEach(event => {
      const url = event.clicked_url as string | null;
      if (url) {
        linkCounts[url] = (linkCounts[url] || 0) + 1;
      }
    });

    const topLinks = Object.entries(linkCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([url, clicks]) => ({ url, clicks }));

    return NextResponse.json({
      campaign,
      stats,
      rates,
      topLinks,
    });
  } catch (error) {
    console.error('Error fetching campaign stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
