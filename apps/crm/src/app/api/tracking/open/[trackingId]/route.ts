import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force dynamic rendering - this route uses env vars at runtime
export const dynamic = 'force-dynamic';

// Create Supabase client lazily to avoid build-time errors
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// 1x1 transparent GIF
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

// GET /api/tracking/open/[trackingId] - Track email open
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackingId: string }> }
) {
  // Use service role for tracking (no auth needed)
  const supabase = getSupabaseClient();
  try {
    const { trackingId } = await params;

    // Parse tracking ID (format: campaignId_recipientId)
    const [campaignId, recipientId] = trackingId.split('_');

    if (!campaignId || !recipientId) {
      // Return pixel anyway to not break email rendering
      return new NextResponse(TRANSPARENT_GIF, {
        headers: {
          'Content-Type': 'image/gif',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
    }

    // Get recipient info
    const { data: recipient } = await supabase
      .from('email_campaign_recipients')
      .select('id, campaign_id, open_count')
      .eq('id', recipientId)
      .eq('campaign_id', campaignId)
      .single();

    if (recipient) {
      const now = new Date().toISOString();
      const isFirstOpen = recipient.open_count === 0;

      // Update recipient record
      await supabase
        .from('email_campaign_recipients')
        .update({
          opened_at: isFirstOpen ? now : undefined,
          open_count: (recipient.open_count || 0) + 1,
        })
        .eq('id', recipientId);

      // Log tracking event
      await supabase.from('campaign_tracking_events').insert({
        campaign_id: campaignId,
        recipient_id: recipientId,
        event_type: 'open',
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        user_agent: request.headers.get('user-agent'),
      });
    }

    // Return 1x1 transparent GIF
    return new NextResponse(TRANSPARENT_GIF, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Error tracking open:', error);
    // Return pixel anyway
    return new NextResponse(TRANSPARENT_GIF, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store',
      },
    });
  }
}
