/**
 * Send Email Edge Function
 *
 * Handles sending emails via Resend API
 * Supports template-based and direct HTML emails
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendEmailRequest {
  to: string;
  toName?: string;
  templateSlug?: string;
  subject?: string;
  html?: string;
  text?: string;
  variables?: Record<string, string>;
  fromEmail?: string;
  fromName?: string;
  replyTo?: string;
  memberId?: string;
  advisorId?: string;
  enrollmentId?: string;
  triggeredBy?: 'manual' | 'system' | 'automation' | 'api';
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get auth token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get user's organization
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.organization_id) {
      return new Response(
        JSON.stringify({ error: 'Organization not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const organizationId = profile.organization_id;
    const body: SendEmailRequest = await req.json();

    // Get email settings
    const { data: settings } = await supabase
      .from('system_settings')
      .select('setting_key, setting_value')
      .eq('organization_id', organizationId)
      .in('setting_key', ['email_from_address', 'email_from_name']);

    const settingsMap = (settings || []).reduce((acc, s) => {
      acc[s.setting_key] = s.setting_value;
      return acc;
    }, {} as Record<string, string>);

    const defaultFromEmail = settingsMap['email_from_address'] || 'noreply@example.com';
    const defaultFromName = settingsMap['email_from_name'] || 'CRM System';

    let subject = body.subject || '';
    let html = body.html || '';
    let text = body.text;
    let templateId: string | null = null;

    // If using template, fetch and process it
    if (body.templateSlug) {
      const { data: template } = await supabase
        .from('email_templates')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('slug', body.templateSlug)
        .eq('is_active', true)
        .single();

      if (template) {
        templateId = template.id;
        subject = replaceVariables(template.subject, body.variables || {});
        html = replaceVariables(template.body_html, body.variables || {});
        text = template.body_text
          ? replaceVariables(template.body_text, body.variables || {})
          : undefined;
      } else {
        return new Response(
          JSON.stringify({ error: 'Template not found' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!subject || !html) {
      return new Response(
        JSON.stringify({ error: 'Subject and HTML content required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fromEmail = body.fromEmail || defaultFromEmail;
    const fromName = body.fromName || defaultFromName;

    // Send via Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: body.toName ? `${body.toName} <${body.to}>` : body.to,
        subject,
        html,
        text,
        reply_to: body.replyTo,
      }),
    });

    const resendResult = await resendResponse.json();

    // Record sent email
    const { data: sentEmail, error: saveError } = await supabase
      .from('sent_emails')
      .insert({
        organization_id: organizationId,
        member_id: body.memberId,
        advisor_id: body.advisorId,
        enrollment_id: body.enrollmentId,
        template_id: templateId,
        email_type: body.templateSlug || 'custom',
        recipient_email: body.to,
        recipient_name: body.toName,
        subject,
        body_html: html,
        body_text: text,
        from_email: fromEmail,
        from_name: fromName,
        reply_to: body.replyTo,
        provider: 'resend',
        provider_message_id: resendResult.id,
        provider_response: resendResult,
        status: resendResult.id ? 'sent' : 'failed',
        error_message: resendResult.error?.message,
        sent_at: resendResult.id ? new Date().toISOString() : null,
        metadata: {
          triggered_by: body.triggeredBy || 'api',
          variables: body.variables,
        },
      })
      .select('id')
      .single();

    if (resendResult.id) {
      return new Response(
        JSON.stringify({
          success: true,
          messageId: resendResult.id,
          sentEmailId: sentEmail?.id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: resendResult.error?.message || 'Failed to send email',
          sentEmailId: sentEmail?.id,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Email sending error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function replaceVariables(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? variables[key] : match;
  });
}
