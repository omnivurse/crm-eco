import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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
    // Parse webhook payload
    const events: SendGridWebhookEvent[] = await request.json();
    
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
