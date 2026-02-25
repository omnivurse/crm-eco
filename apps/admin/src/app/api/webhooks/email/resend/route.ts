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
 * Handle Resend email events for admin app emails
 */
export async function POST(request: NextRequest) {
  try {
    const svixId = request.headers.get('svix-id');
    const svixTimestamp = request.headers.get('svix-timestamp');
    const svixSignature = request.headers.get('svix-signature');

    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json(
        { error: 'Missing webhook signature headers' },
        { status: 401 }
      );
    }

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

    // Find the sent email by provider_message_id or resend_id
    const { data: sentEmail } = await (supabase as ReturnType<typeof createServiceClient> & { from: CallableFunction })
      .from('sent_emails_log')
      .select('id, tracking_id, org_id, organization_id')
      .or(`provider_message_id.eq.${emailId},resend_id.eq.${emailId}`)
      .limit(1)
      .single();

    if (!sentEmail) {
      return NextResponse.json({ received: true, matched: false });
    }

    const orgId = sentEmail.org_id || sentEmail.organization_id;
    const ourEventType = EVENT_TYPE_MAP[event.type];

    if (ourEventType && orgId) {
      await (supabase as ReturnType<typeof createServiceClient> & { from: CallableFunction })
        .from('email_tracking_events')
        .insert({
          org_id: orgId,
          tracking_id: sentEmail.tracking_id,
          event_type: ourEventType,
          clicked_url: event.data.click?.link || null,
          bounce_type: event.data.bounce?.type || null,
          bounce_reason: event.data.bounce?.message || null,
          occurred_at: event.created_at || new Date().toISOString(),
        });
    }

    const newStatus = STATUS_MAP[event.type];
    if (newStatus) {
      await (supabase as ReturnType<typeof createServiceClient> & { from: CallableFunction })
        .from('sent_emails_log')
        .update({ status: newStatus })
        .eq('id', sentEmail.id);
    }

    return NextResponse.json({ received: true, matched: true });
  } catch (error) {
    console.error('Error processing Resend webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
