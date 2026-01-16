import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, sendSms } from '@/lib/email/send-service';

/**
 * POST /api/communications/send
 * Send an email or SMS through configured providers
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { channel, ...params } = body;
    
    if (!channel) {
      return NextResponse.json(
        { error: 'Missing required field: channel (email or sms)' },
        { status: 400 }
      );
    }
    
    if (channel === 'email') {
      // Validate email params
      if (!params.to || !params.subject) {
        return NextResponse.json(
          { error: 'Missing required fields for email: to, subject' },
          { status: 400 }
        );
      }
      
      if (!params.body_html && !params.body_text) {
        return NextResponse.json(
          { error: 'Email must have body_html or body_text' },
          { status: 400 }
        );
      }
      
      const result = await sendEmail({
        to: params.to,
        subject: params.subject,
        body_html: params.body_html,
        body_text: params.body_text,
        cc: params.cc,
        bcc: params.bcc,
        from_name: params.from_name,
        reply_to: params.reply_to,
        template_id: params.template_id,
        template_variables: params.template_variables,
        linked_contact_id: params.linked_contact_id,
        linked_lead_id: params.linked_lead_id,
        linked_deal_id: params.linked_deal_id,
      });
      
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to send email' },
          { status: 500 }
        );
      }
      
      return NextResponse.json({
        success: true,
        channel: 'email',
        message_id: result.message_id,
        provider: result.provider,
      });
    }
    
    if (channel === 'sms') {
      // Validate SMS params
      if (!params.to || !params.body) {
        return NextResponse.json(
          { error: 'Missing required fields for SMS: to, body' },
          { status: 400 }
        );
      }
      
      const result = await sendSms({
        to: params.to,
        body: params.body,
        linked_contact_id: params.linked_contact_id,
        linked_lead_id: params.linked_lead_id,
        linked_deal_id: params.linked_deal_id,
      });
      
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to send SMS' },
          { status: 500 }
        );
      }
      
      return NextResponse.json({
        success: true,
        channel: 'sms',
        message_id: result.message_id,
        provider: result.provider,
      });
    }
    
    return NextResponse.json(
      { error: 'Invalid channel. Must be "email" or "sms"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in POST /api/communications/send:', error);
    return NextResponse.json(
      { error: 'Failed to send communication' },
      { status: 500 }
    );
  }
}
