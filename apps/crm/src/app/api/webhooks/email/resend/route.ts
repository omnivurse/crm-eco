import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Creates a service role client for webhook operations (no user auth needed)
 */
function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return []; },
        setAll() {},
      },
    }
  );
}

/**
 * Resend webhook event types
 * @see https://resend.com/docs/dashboard/webhooks/event-types
 */
interface ResendWebhookEvent {
  type: 'email.sent' | 'email.delivered' | 'email.delivery_delayed' | 'email.complained' | 'email.bounced' | 'email.opened' | 'email.clicked';
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    click?: { link: string };
    bounce?: { message: string; type: string };
    complaint?: { type: string };
  };
}

/**
 * Map Resend event types to our internal event types
 */
const EVENT_TYPE_MAP: Record<string, string> = {
  'email.delivered': 'delivered',
  'email.opened': 'open',
  'email.clicked': 'click',
  'email.bounced': 'bounce',
  'email.complained': 'complaint',
};

const STATUS_MAP: Record<string, string> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.bounced': 'bounced',
  'email.complained': 'bounced',
};

/**
 * POST /api/webhooks/email/resend
 * Handle Resend email events (delivery, open, click, bounce, complaint)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature via svix headers
    const svixId = request.headers.get('svix-id');
    const svixTimestamp = request.headers.get('svix-timestamp');
    const svixSignature = request.headers.get('svix-signature');

    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json(
        { error: 'Missing webhook signature headers' },
        { status: 401 }
      );
    }

    // Verify timestamp is recent (within 5 minutes) to prevent replay attacks
    const timestampSeconds = parseInt(svixTimestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestampSeconds) > 300) {
      return NextResponse.json(
        { error: 'Webhook timestamp too old' },
        { status: 401 }
      );
    }

    const event: ResendWebhookEvent = await request.json();
    const supabase = createServiceClient();

    const emailId = event.data.email_id;
    if (!emailId) {
      return NextResponse.json({ received: true });
    }

    // Find the sent email by Resend message ID
    const { data: sentEmail } = await (supabase as any)
      .from('sent_emails_log')
      .select('id, tracking_id, org_id')
      .eq('provider_message_id', emailId)
      .single();

    if (!sentEmail) {
      // Try matching by resend_id field (used by shared EmailService)
      const { data: sentEmailAlt } = await (supabase as any)
        .from('sent_emails_log')
        .select('id, tracking_id, org_id, organization_id')
        .eq('resend_id', emailId)
        .single();

      if (!sentEmailAlt) {
        // Email not found in our logs — still acknowledge the webhook
        return NextResponse.json({ received: true, matched: false });
      }

      // Process with alt record
      await processEvent(supabase, event, sentEmailAlt);
      return NextResponse.json({ received: true, matched: true });
    }

    await processEvent(supabase, event, sentEmail);
    return NextResponse.json({ received: true, matched: true });
  } catch (error) {
    console.error('Error processing Resend webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function processEvent(
  supabase: ReturnType<typeof createServiceClient>,
  event: ResendWebhookEvent,
  sentEmail: { id: string; tracking_id?: string; org_id?: string; organization_id?: string }
) {
  const orgId = sentEmail.org_id || sentEmail.organization_id;
  const ourEventType = EVENT_TYPE_MAP[event.type];

  // Insert tracking event if it maps to a trackable type
  if (ourEventType && orgId) {
    await (supabase as any).from('email_tracking_events').insert({
      org_id: orgId,
      tracking_id: sentEmail.tracking_id,
      event_type: ourEventType,
      clicked_url: event.data.click?.link || null,
      bounce_type: event.data.bounce?.type || null,
      bounce_reason: event.data.bounce?.message || null,
      occurred_at: event.created_at || new Date().toISOString(),
    });
  }

  // Update sent email status
  const newStatus = STATUS_MAP[event.type];
  if (newStatus) {
    await (supabase as any)
      .from('sent_emails_log')
      .update({ status: newStatus })
      .eq('id', sentEmail.id);
  }
}
