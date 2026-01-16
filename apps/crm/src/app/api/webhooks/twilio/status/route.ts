import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { mapTwilioStatusToMessageStatus } from '@/lib/comms/providers/twilio';

// Use service role client for webhook processing
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * POST /api/webhooks/twilio/status
 * Receive Twilio SMS status callbacks
 */
export async function POST(request: NextRequest) {
  try {
    // Parse form data (Twilio sends application/x-www-form-urlencoded)
    const formData = await request.formData();
    
    const messageSid = formData.get('MessageSid') as string;
    const messageStatus = formData.get('MessageStatus') as string;
    const errorCode = formData.get('ErrorCode') as string | null;
    const errorMessage = formData.get('ErrorMessage') as string | null;

    if (!messageSid || !messageStatus) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const supabase = getServiceClient();

    // Find message by provider_message_id
    const { data: message } = await supabase
      .from('crm_messages')
      .select('id, org_id, status')
      .eq('provider_message_id', messageSid)
      .single();

    if (!message) {
      // Message not found, but return 200 to acknowledge receipt
      return NextResponse.json({ success: true, message: 'Message not found' });
    }

    // Create event record
    await supabase.from('crm_message_events').insert({
      org_id: message.org_id,
      message_id: message.id,
      event: messageStatus.toLowerCase(),
      payload: {
        MessageSid: messageSid,
        MessageStatus: messageStatus,
        ErrorCode: errorCode,
        ErrorMessage: errorMessage,
      },
    });

    // Map and update status
    const newStatus = mapTwilioStatusToMessageStatus(messageStatus);
    
    const updateData: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (errorCode || errorMessage) {
      updateData.error = errorMessage || `Error code: ${errorCode}`;
    }

    await supabase
      .from('crm_messages')
      .update(updateData)
      .eq('id', message.id);

    // Return TwiML response (empty is fine for status callbacks)
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error) {
    console.error('Twilio status webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
