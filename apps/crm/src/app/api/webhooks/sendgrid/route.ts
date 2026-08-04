import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { EventWebhook, EventWebhookHeader } from '@sendgrid/eventwebhook';
import { mapSendGridEventToStatus, shouldUpdateStatus } from '@/lib/comms/providers/sendgrid';
import type { SendGridWebhookEvent } from '@/lib/comms/types';

// Use service role client for webhook processing (no user context)
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * POST /api/webhooks/sendgrid
 * Receive SendGrid event webhooks
 */
export async function POST(request: NextRequest) {
  try {
    // Cryptographically verify the SendGrid signature (ECDSA over the RAW body).
    //
    // This block previously only checked that the two headers were *present* —
    // any non-empty value passed — and skipped entirely when the verification key
    // was unset. Anyone could therefore POST forged delivery/bounce/spam events,
    // which are then written with the service-role client below. The correct
    // implementation already existed at /api/webhooks/email/sendgrid; this is the
    // same verification, using the @sendgrid/eventwebhook dependency the project
    // already carries.
    const verificationKey = process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY;
    if (!verificationKey) {
      console.error('[SendGrid Webhook] SENDGRID_WEBHOOK_VERIFICATION_KEY is not configured');
      return NextResponse.json(
        { error: 'Webhook verification key not configured' },
        { status: 500 },
      );
    }

    const signature = request.headers.get(EventWebhookHeader.SIGNATURE());
    const timestamp = request.headers.get(EventWebhookHeader.TIMESTAMP());

    if (!signature || !timestamp) {
      console.warn('[SendGrid Webhook] Missing signature headers');
      return NextResponse.json({ error: 'Missing webhook signature headers' }, { status: 401 });
    }

    // Must read the raw text: ECDSA verifies the exact bytes SendGrid signed, so
    // `request.json()` (which reserializes) would break verification.
    const rawBody = await request.text();

    const eventWebhook = new EventWebhook();
    const ecPublicKey = eventWebhook.convertPublicKeyToECDSA(verificationKey);
    if (!eventWebhook.verifySignature(ecPublicKey, rawBody, signature, timestamp)) {
      console.warn('[SendGrid Webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

    const events: SendGridWebhookEvent[] = JSON.parse(rawBody);

    if (!Array.isArray(events)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const supabase = getServiceClient();
    let processed = 0;

    for (const event of events) {
      // Find message by provider_message_id
      // SendGrid sg_message_id format: filter_id.message_id.smtp_id
      const messageId = event.sg_message_id?.split('.')[0];
      
      if (!messageId) {
        continue;
      }

      // Look up message
      const { data: message } = await supabase
        .from('crm_messages')
        .select('id, org_id, status')
        .or(`provider_message_id.eq.${messageId},id.eq.${messageId}`)
        .single();

      if (!message) {
        // Try matching by our internal message_id from custom_args
        continue;
      }

      // Create event record
      await supabase.from('crm_message_events').insert({
        org_id: message.org_id,
        message_id: message.id,
        event: event.event,
        payload: event as unknown as Record<string, unknown>,
      });

      // Update message status if applicable
      if (shouldUpdateStatus(event.event)) {
        const newStatus = mapSendGridEventToStatus(event.event);
        
        // Only update if status is progressing forward
        const statusOrder = ['queued', 'sending', 'sent', 'delivered', 'bounced', 'failed', 'spam', 'unsubscribed'];
        const currentIndex = statusOrder.indexOf(message.status);
        const newIndex = statusOrder.indexOf(newStatus);
        
        if (newIndex > currentIndex || ['bounced', 'failed', 'spam', 'unsubscribed'].includes(newStatus)) {
          await supabase
            .from('crm_messages')
            .update({
              status: newStatus,
              error: event.reason || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', message.id);
        }
      }

      processed++;
    }

    return NextResponse.json({ success: true, processed });
  } catch (error) {
    console.error('SendGrid webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
