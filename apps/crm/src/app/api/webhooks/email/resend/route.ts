import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { Webhook } from 'svix';

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

/**
 * Map Resend event types to our internal event types
 * Must match email_events.event_type values that the DB trigger handles
 */
const EVENT_TYPE_MAP: Record<string, string> = {
  'email.delivered': 'delivered',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
};

/**
 * POST /api/webhooks/email/resend
 * Handle Resend email events (delivery, open, click, bounce, complaint)
 * Inserts into email_events — the DB trigger auto-updates sent_emails
 */
export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('RESEND_WEBHOOK_SECRET is not configured');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    const svixId = request.headers.get('svix-id');
    const svixTimestamp = request.headers.get('svix-timestamp');
    const svixSignature = request.headers.get('svix-signature');

    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json(
        { error: 'Missing webhook signature headers' },
        { status: 401 }
      );
    }

    const body = await request.text();

    // Cryptographically verify the webhook signature using Svix
    const wh = new Webhook(webhookSecret);
    let event: ResendWebhookEvent;
    try {
      event = wh.verify(body, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as ResendWebhookEvent;
    } catch {
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceClient() as any;

    const emailId = event.data.email_id;
    if (!emailId) {
      return NextResponse.json({ received: true });
    }

    // Find the sent email by provider_message_id (Resend email ID)
    const { data: sentEmail } = await supabase
      .from('sent_emails')
      .select('id')
      .eq('provider_message_id', emailId)
      .single();

    if (!sentEmail) {
      return NextResponse.json({ received: true, matched: false });
    }

    const ourEventType = EVENT_TYPE_MAP[event.type];
    if (!ourEventType) {
      return NextResponse.json({ received: true });
    }

    // Deduplicate: skip if we already processed this exact event
    const occurredAt = event.created_at || new Date().toISOString();
    const { data: existing } = await supabase
      .from('email_events')
      .select('id')
      .eq('sent_email_id', sentEmail.id)
      .eq('provider_message_id', emailId)
      .eq('event_type', ourEventType)
      .eq('occurred_at', occurredAt)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ received: true, matched: true, duplicate: true });
    }

    // Insert into email_events — DB trigger auto-updates sent_emails
    await supabase.from('email_events').insert({
      sent_email_id: sentEmail.id,
      provider_message_id: emailId,
      event_type: ourEventType,
      event_data: {
        clicked_url: event.data.click?.link || null,
        bounce_type: event.data.bounce?.type || null,
        bounce_reason: event.data.bounce?.message || null,
        complaint_type: event.data.complaint?.type || null,
      },
      occurred_at: occurredAt,
    });

    return NextResponse.json({ received: true, matched: true });
  } catch (error) {
    console.error('Error processing Resend webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
