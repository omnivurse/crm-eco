import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role for tracking (no auth needed)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/tracking/click/[trackingId] - Track link click and redirect
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackingId: string }> }
) {
  try {
    const { trackingId } = await params;
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

    // If no target URL, redirect to home
    if (!targetUrl) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Parse tracking ID (format: campaignId_recipientId)
    const [campaignId, recipientId] = trackingId.split('_');

    if (campaignId && recipientId) {
      // Get recipient info
      const { data: recipient } = await supabase
        .from('email_campaign_recipients')
        .select('id, campaign_id, click_count')
        .eq('id', recipientId)
        .eq('campaign_id', campaignId)
        .single();

      if (recipient) {
        const now = new Date().toISOString();
        const isFirstClick = recipient.click_count === 0;

        // Update recipient record
        await supabase
          .from('email_campaign_recipients')
          .update({
            clicked_at: isFirstClick ? now : undefined,
            click_count: (recipient.click_count || 0) + 1,
          })
          .eq('id', recipientId);

        // Log tracking event
        await supabase.from('campaign_tracking_events').insert({
          campaign_id: campaignId,
          recipient_id: recipientId,
          event_type: 'click',
          metadata: { url: targetUrl },
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
          user_agent: request.headers.get('user-agent'),
        });
      }
    }

    // Redirect to target URL
    return NextResponse.redirect(targetUrl);
  } catch (error) {
    console.error('Error tracking click:', error);
    // Try to redirect anyway
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');
    if (targetUrl) {
      return NextResponse.redirect(targetUrl);
    }
    return NextResponse.redirect(new URL('/', request.url));
  }
}
