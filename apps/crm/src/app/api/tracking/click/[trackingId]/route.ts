import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force dynamic rendering - this route uses env vars at runtime
export const dynamic = 'force-dynamic';

/**
 * Validate redirect URL to prevent open redirect attacks.
 * Only allows absolute HTTP(S) URLs with non-private hosts.
 */
function isValidRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const hostname = parsed.hostname.toLowerCase();
    // Block internal/private hostnames
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '[::1]' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// Create Supabase client lazily to avoid build-time errors
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/tracking/click/[trackingId] - Track link click and redirect
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackingId: string }> }
) {
  // Use service role for tracking (no auth needed)
  const supabase = getSupabaseClient();
  try {
    const { trackingId } = await params;
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

    // If no target URL or invalid URL, redirect to home
    if (!targetUrl || !isValidRedirectUrl(targetUrl)) {
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
    if (targetUrl && isValidRedirectUrl(targetUrl)) {
      return NextResponse.redirect(targetUrl);
    }
    return NextResponse.redirect(new URL('/', request.url));
  }
}
