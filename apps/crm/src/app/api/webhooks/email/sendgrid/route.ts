import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';

/**
 * POST /api/webhooks/email/sendgrid
 * Handle SendGrid email events (open, click, bounce, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const events = await request.json();
    
    if (!Array.isArray(events)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    
    const supabase = await createServerSupabaseClient() as any;
    
    for (const event of events) {
      const {
        event: eventType,
        sg_message_id,
        timestamp,
        ip,
        useragent,
        url,
        reason,
        type: bounceType,
      } = event;
      
      // Skip if no message ID
      if (!sg_message_id) continue;
      
      // Find the sent email by message ID
      const { data: sentEmail } = await supabase
        .from('sent_emails_log')
        .select('id, tracking_id, org_id')
        .eq('provider_message_id', sg_message_id)
        .single();
      
      if (!sentEmail) continue;
      
      // Map SendGrid event to our event type
      const eventTypeMap: Record<string, string> = {
        'delivered': 'delivered',
        'open': 'open',
        'click': 'click',
        'bounce': 'bounce',
        'dropped': 'bounce',
        'spamreport': 'complaint',
        'unsubscribe': 'unsubscribe',
      };
      
      const ourEventType = eventTypeMap[eventType];
      if (!ourEventType) continue;
      
      // Insert tracking event
      await supabase.from('email_tracking_events').insert({
        org_id: sentEmail.org_id,
        tracking_id: sentEmail.tracking_id,
        event_type: ourEventType,
        ip_address: ip,
        user_agent: useragent,
        clicked_url: url,
        bounce_type: bounceType,
        bounce_reason: reason,
        occurred_at: timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString(),
      });
      
      // Update sent email status
      const statusMap: Record<string, string> = {
        'delivered': 'delivered',
        'open': 'opened',
        'click': 'clicked',
        'bounce': 'bounced',
        'dropped': 'failed',
      };
      
      const newStatus = statusMap[eventType];
      if (newStatus) {
        await supabase
          .from('sent_emails_log')
          .update({ status: newStatus })
          .eq('id', sentEmail.id);
      }
    }
    
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing SendGrid webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
