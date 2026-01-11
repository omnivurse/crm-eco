import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizePhoneNumber } from '@/lib/comms/providers/twilio';

// Use service role client for webhook processing
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * POST /api/webhooks/twilio/inbound
 * Receive inbound SMS messages from Twilio
 */
export async function POST(request: NextRequest) {
  try {
    // Parse form data
    const formData = await request.formData();
    
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

    // Find matching record by phone number
    // First try exact match on phone field, then search in data
    const { data: records } = await supabase
      .from('crm_records')
      .select('id, org_id, phone')
      .or(`phone.eq.${normalizedFrom},phone.eq.${from}`)
      .limit(1);

    let record = records?.[0];

    // If no direct match, try searching in data jsonb
    if (!record) {
      const { data: jsonbRecords } = await supabase
        .from('crm_records')
        .select('id, org_id')
        .or(`data->phone.eq."${from}",data->mobile.eq."${from}",data->phone.eq."${normalizedFrom}",data->mobile.eq."${normalizedFrom}"`)
        .limit(1);
      
      record = jsonbRecords?.[0];
    }

    if (!record) {
      // No matching record found - could create a new lead here
      // For now, just acknowledge receipt
      console.log('Inbound SMS from unknown number:', from);
      
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

    // TODO: Trigger workflow for inbound SMS if configured

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
