import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizePhoneNumber } from '@/lib/comms/providers/twilio';
import crypto from 'crypto';

// Use service role client for webhook processing
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Validate a Twilio webhook signature (HMAC-SHA1)
 * @see https://www.twilio.com/docs/usage/security#validating-requests
 */
function validateTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  // Sort params alphabetically and append key+value to URL
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);

  const expectedSignature = crypto
    .createHmac('sha1', authToken)
    .update(data)
    .digest('base64');

  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * POST /api/webhooks/twilio/inbound
 * Receive inbound SMS messages from Twilio
 */
export async function POST(request: NextRequest) {
  try {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken) {
      console.error('TWILIO_AUTH_TOKEN is not configured');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
    }

    // Parse form data first so we can use params for signature validation
    const formData = await request.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = value.toString();
    });

    // Verify Twilio webhook signature
    const twilioSignature = request.headers.get('x-twilio-signature');
    if (!twilioSignature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    const webhookUrl = process.env.TWILIO_WEBHOOK_URL_INBOUND || request.url;
    if (!validateTwilioSignature(authToken, twilioSignature, webhookUrl, params)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    const messageSid = formData.get('MessageSid') as string;
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;
    const body = formData.get('Body') as string;
    const numMedia = parseInt(formData.get('NumMedia') as string || '0', 10);

    if (!messageSid || !from || !body) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const supabase = getServiceClient();
    const normalizedFrom = normalizePhoneNumber(from);

    // Find matching record by phone number using parameterized queries
    // (no string interpolation to prevent PostgREST filter injection)
    // Also use RPC to scope by org for cross-tenant safety
    const { data: records } = await supabase
      .rpc('find_record_by_phone', {
        phone_raw: from,
        phone_normalized: normalizedFrom,
      });

    let record = records?.[0] as { id: string; org_id: string; phone: string } | undefined;

    if (!record) {
      // No matching record found - could create a new lead here
      // For now, just acknowledge receipt
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { status: 200, headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // Find or create thread
    let threadId: string;
    
    const { data: existingThread } = await supabase
      .from('crm_message_threads')
      .select('id')
      .eq('record_id', record.id)
      .eq('channel', 'sms')
      .eq('participant_address', normalizedFrom)
      .single();

    if (existingThread) {
      threadId = existingThread.id;
    } else {
      const { data: newThread } = await supabase
        .from('crm_message_threads')
        .insert({
          org_id: record.org_id,
          record_id: record.id,
          channel: 'sms',
          participant_address: normalizedFrom,
        })
        .select('id')
        .single();
      
      threadId = newThread!.id;
    }

    // Create inbound message record
    const { data: message } = await supabase
      .from('crm_messages')
      .insert({
        org_id: record.org_id,
        record_id: record.id,
        thread_id: threadId,
        channel: 'sms',
        direction: 'inbound',
        to_address: to,
        from_address: from,
        body: body,
        status: 'delivered',
        provider: 'twilio',
        provider_message_id: messageSid,
        meta: {
          num_media: numMedia,
        },
        sent_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    // Create event
    await supabase.from('crm_message_events').insert({
      org_id: record.org_id,
      message_id: message!.id,
      event: 'inbound_received',
      payload: {
        MessageSid: messageSid,
        From: from,
        To: to,
        NumMedia: numMedia,
      },
    });

    // Trigger workflows for inbound SMS
    try {
      // Get the full record data for workflow execution
      const { data: fullRecord } = await supabase
        .from('crm_records')
        .select('*')
        .eq('id', record.id)
        .single();

      if (fullRecord) {
        // Find workflows with on_update trigger that listen for SMS events
        const { data: workflows } = await supabase
          .from('crm_workflows')
          .select('*')
          .eq('org_id', record.org_id)
          .eq('module_id', fullRecord.module_id)
          .eq('is_enabled', true)
          .in('trigger_type', ['on_update', 'on_create'])
          .order('priority', { ascending: true });

        if (workflows && workflows.length > 0) {
          // Execute matching workflows
          for (const workflow of workflows) {
            // Check if workflow has SMS-related trigger config
            const triggerConfig = workflow.trigger_config as Record<string, unknown> || {};
            const watchedEvents = triggerConfig.events as string[] || [];
            
            // Execute if workflow watches for 'sms_inbound' or has no specific event filter
            if (watchedEvents.length === 0 || watchedEvents.includes('sms_inbound')) {
              // Import and execute dynamically to avoid circular dependencies
              const { executeWorkflow } = await import('@/lib/automation/engine');
              
              await executeWorkflow({
                workflow: workflow as any,
                record: {
                  ...fullRecord,
                  // Add inbound SMS context to record for condition evaluation
                  _sms_context: {
                    inbound_message: body,
                    from_number: from,
                    message_id: message!.id,
                  },
                } as any,
                trigger: workflow.trigger_type,
                idempotencyKey: `sms-inbound-${messageSid}-${workflow.id}`,
              });
            }
          }
        }

        // Also create a notification for the record owner
        if (fullRecord.owner_id) {
          await supabase.from('crm_notifications').insert({
            org_id: record.org_id,
            user_id: fullRecord.owner_id,
            title: 'New SMS Received',
            body: `Inbound SMS from ${from}: "${body.substring(0, 100)}${body.length > 100 ? '...' : ''}"`,
            href: `/crm/r/${record.id}`,
            meta: {
              message_id: message!.id,
              from_number: from,
            },
          });
        }
      }
    } catch (workflowError) {
      // Log but don't fail the webhook
      console.error('Failed to trigger workflows for inbound SMS:', workflowError);
    }

    // Return TwiML response
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { status: 200, headers: { 'Content-Type': 'text/xml' } }
    );
  } catch (error) {
    console.error('Twilio inbound webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
