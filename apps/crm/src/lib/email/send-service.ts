import { createServerSupabaseClient as createClient } from '@crm-eco/lib/supabase/server';
import { createLog } from '@/lib/integrations';
import { decrypt } from '@/lib/integrations/adapters/credentials';

// ============================================================================
// Email Send Service
// Send emails via configured providers and log results
// ============================================================================

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  body_html?: string;
  body_text?: string;
  cc?: string[];
  bcc?: string[];
  from_name?: string;
  reply_to?: string;
  template_id?: string;
  template_variables?: Record<string, unknown>;
  linked_contact_id?: string;
  linked_lead_id?: string;
  linked_deal_id?: string;
}

export interface SendEmailResult {
  success: boolean;
  message_id?: string;
  provider?: string;
  error?: string;
}

export interface SendSmsParams {
  to: string;
  body: string;
  linked_contact_id?: string;
  linked_lead_id?: string;
  linked_deal_id?: string;
}

export interface SendSmsResult {
  success: boolean;
  message_id?: string;
  provider?: string;
  error?: string;
}

// Helper to get supabase client with any table access
async function getSupabaseAny() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any;
}

// ============================================================================
// Email Sending
// ============================================================================

/**
 * Send an email through the configured provider
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const supabase = await getSupabaseAny();
  
  // Get current user and org
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, organization_id, email, full_name')
    .eq('user_id', user.id)
    .single();
  
  if (!profile) throw new Error('User profile not found');
  
  // Get organization settings for email
  const { data: org } = await supabase
    .from('organizations')
    .select('name, settings')
    .eq('id', profile.organization_id)
    .single();
  
  // Get email integration connection
  const { data: emailConnection } = await supabase
    .from('integration_connections')
    .select('*')
    .eq('org_id', profile.organization_id)
    .eq('connection_type', 'email')
    .eq('status', 'connected')
    .single();
  
  const toEmails = Array.isArray(params.to) ? params.to : [params.to];
  const fromEmail = profile.email;
  const fromName = params.from_name || profile.full_name || org?.name || 'CRM';
  
  // Determine provider and send
  let result: SendEmailResult;
  const provider = emailConnection?.provider || 'resend';
  const startTime = Date.now();
  
  try {
    if (provider === 'sendgrid' && emailConnection?.api_key_enc) {
      const apiKey = decrypt(emailConnection.api_key_enc);
      result = await sendViaSendGrid(apiKey, {
        from: { email: fromEmail, name: fromName },
        to: toEmails,
        cc: params.cc,
        bcc: params.bcc,
        subject: params.subject,
        html: params.body_html,
        text: params.body_text,
        replyTo: params.reply_to,
      });
    } else if (provider === 'resend' && emailConnection?.api_key_enc) {
      const apiKey = decrypt(emailConnection.api_key_enc);
      result = await sendViaResend(apiKey, {
        from: `${fromName} <${fromEmail}>`,
        to: toEmails,
        cc: params.cc,
        bcc: params.bcc,
        subject: params.subject,
        html: params.body_html,
        text: params.body_text,
        reply_to: params.reply_to,
      });
    } else {
      // Simulate sending if no provider configured
      result = await simulateSend(toEmails, params.subject);
    }
    
    // Log to sent_emails_log
    await supabase.from('sent_emails_log').insert({
      org_id: profile.organization_id,
      sent_by: profile.id,
      from_email: fromEmail,
      from_name: fromName,
      to_emails: toEmails,
      cc_emails: params.cc || [],
      bcc_emails: params.bcc || [],
      subject: params.subject,
      body_html: params.body_html,
      body_text: params.body_text,
      template_id: params.template_id,
      template_variables: params.template_variables,
      provider: provider,
      provider_message_id: result.message_id,
      status: result.success ? 'sent' : 'failed',
      error_message: result.error,
      linked_contact_id: params.linked_contact_id,
      linked_lead_id: params.linked_lead_id,
      linked_deal_id: params.linked_deal_id,
      sent_at: result.success ? new Date().toISOString() : null,
    });
    
    // Log to integration logs
    if (emailConnection) {
      await createLog({
        connection_id: emailConnection.id,
        event_type: 'api_call',
        provider: provider,
        direction: 'outbound',
        method: 'POST',
        endpoint: '/send',
        status: result.success ? 'success' : 'error',
        error_message: result.error,
        duration_ms: Date.now() - startTime,
        entity_type: params.linked_contact_id ? 'contact' : params.linked_lead_id ? 'lead' : undefined,
        entity_id: params.linked_contact_id || params.linked_lead_id,
      });
    }
    
    // Create CRM activity
    if (result.success && (params.linked_contact_id || params.linked_lead_id || params.linked_deal_id)) {
      await supabase.from('crm_activities').insert({
        organization_id: profile.organization_id,
        record_id: params.linked_contact_id || params.linked_lead_id || params.linked_deal_id,
        module_key: params.linked_contact_id ? 'Contacts' : params.linked_lead_id ? 'Leads' : 'Deals',
        activity_type: 'email',
        description: `Email sent: ${params.subject}`,
        created_by: profile.id,
        metadata: {
          to: toEmails,
          subject: params.subject,
          provider: provider,
          message_id: result.message_id,
        },
      });
    }
    
    return result;
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// SMS Sending
// ============================================================================

/**
 * Send an SMS through Twilio
 */
export async function sendSms(params: SendSmsParams): Promise<SendSmsResult> {
  const supabase = await getSupabaseAny();
  
  // Get current user and org
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, organization_id')
    .eq('user_id', user.id)
    .single();
  
  if (!profile) throw new Error('User profile not found');
  
  // Get Twilio connection
  const { data: twilioConnection } = await supabase
    .from('integration_connections')
    .select('*')
    .eq('org_id', profile.organization_id)
    .eq('provider', 'twilio')
    .eq('status', 'connected')
    .single();
  
  const startTime = Date.now();
  let result: SendSmsResult;
  
  try {
    if (twilioConnection?.api_key_enc && twilioConnection?.api_secret_enc) {
      const accountSid = decrypt(twilioConnection.api_key_enc);
      const authToken = decrypt(twilioConnection.api_secret_enc);
      result = await sendViaTwilio(
        accountSid,
        authToken,
        twilioConnection.settings?.phone_number as string || '',
        params.to,
        params.body
      );
    } else {
      // Simulate if not configured
      result = {
        success: true,
        message_id: `sim_${Date.now()}`,
        provider: 'simulated',
      };
    }
    
    // Log to sent_sms_log
    await supabase.from('sent_sms_log').insert({
      org_id: profile.organization_id,
      sent_by: profile.id,
      from_number: twilioConnection?.settings?.phone_number || '+1234567890',
      to_number: params.to,
      body: params.body,
      provider: twilioConnection ? 'twilio' : 'simulated',
      provider_message_id: result.message_id,
      status: result.success ? 'sent' : 'failed',
      error_message: result.error,
      linked_contact_id: params.linked_contact_id,
      linked_lead_id: params.linked_lead_id,
      linked_deal_id: params.linked_deal_id,
      sent_at: result.success ? new Date().toISOString() : null,
    });
    
    // Log to integration logs
    if (twilioConnection) {
      await createLog({
        connection_id: twilioConnection.id,
        event_type: 'api_call',
        provider: 'twilio',
        direction: 'outbound',
        method: 'POST',
        endpoint: '/messages',
        status: result.success ? 'success' : 'error',
        error_message: result.error,
        duration_ms: Date.now() - startTime,
      });
    }
    
    return result;
  } catch (error) {
    console.error('Error sending SMS:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Provider Implementations
// ============================================================================

async function sendViaSendGrid(
  apiKey: string,
  params: {
    from: { email: string; name: string };
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    html?: string;
    text?: string;
    replyTo?: string;
  }
): Promise<SendEmailResult> {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{
        to: params.to.map(email => ({ email })),
        cc: params.cc?.map(email => ({ email })),
        bcc: params.bcc?.map(email => ({ email })),
      }],
      from: params.from,
      reply_to: params.replyTo ? { email: params.replyTo } : undefined,
      subject: params.subject,
      content: [
        params.text ? { type: 'text/plain', value: params.text } : null,
        params.html ? { type: 'text/html', value: params.html } : null,
      ].filter(Boolean),
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    return { success: false, error, provider: 'sendgrid' };
  }
  
  const messageId = response.headers.get('X-Message-Id') || `sg_${Date.now()}`;
  return { success: true, message_id: messageId, provider: 'sendgrid' };
}

async function sendViaResend(
  apiKey: string,
  params: {
    from: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    html?: string;
    text?: string;
    reply_to?: string;
  }
): Promise<SendEmailResult> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: params.from,
      to: params.to,
      cc: params.cc,
      bcc: params.bcc,
      subject: params.subject,
      html: params.html,
      text: params.text,
      reply_to: params.reply_to,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    return { success: false, error: error.message || 'Resend error', provider: 'resend' };
  }
  
  const data = await response.json();
  return { success: true, message_id: data.id, provider: 'resend' };
}

async function sendViaTwilio(
  accountSid: string,
  authToken: string,
  fromNumber: string,
  toNumber: string,
  body: string
): Promise<SendSmsResult> {
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: fromNumber,
        To: toNumber,
        Body: body,
      }).toString(),
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    return { success: false, error: error.message || 'Twilio error', provider: 'twilio' };
  }
  
  const data = await response.json();
  return { success: true, message_id: data.sid, provider: 'twilio' };
}

async function simulateSend(to: string[], subject: string): Promise<SendEmailResult> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  console.log(`[SIMULATED] Sending email to ${to.join(', ')}: ${subject}`);
  
  return {
    success: true,
    message_id: `sim_${Date.now()}`,
    provider: 'simulated',
  };
}
