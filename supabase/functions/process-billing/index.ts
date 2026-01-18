/**
 * Process Billing Edge Function
 *
 * Scheduled function to process recurring billing
 * - Processes due billing schedules
 * - Handles retry logic for failed payments
 * - Sends email notifications
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessingResult {
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: string[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get Authorize.Net credentials
    const apiLoginId = Deno.env.get('AUTHORIZE_NET_API_LOGIN_ID');
    const transactionKey = Deno.env.get('AUTHORIZE_NET_TRANSACTION_KEY');
    const environment = Deno.env.get('AUTHORIZE_NET_ENVIRONMENT') || 'sandbox';

    if (!apiLoginId || !transactionKey) {
      return new Response(
        JSON.stringify({ error: 'Payment gateway not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiEndpoint = environment === 'production'
      ? 'https://api.authorize.net/xml/v1/request.api'
      : 'https://apitest.authorize.net/xml/v1/request.api';

    const merchantAuth = { name: apiLoginId, transactionKey };

    const today = new Date().toISOString().split('T')[0];
    const results: ProcessingResult = {
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    // 1. Process due billing schedules
    const { data: dueSchedules, error: scheduleError } = await supabase
      .from('billing_schedules')
      .select(`
        *,
        payment_profiles (
          id,
          authorize_customer_profile_id,
          authorize_payment_profile_id,
          is_active
        ),
        members (
          id,
          email,
          first_name,
          last_name
        ),
        enrollments (
          id,
          status
        )
      `)
      .eq('status', 'active')
      .lte('next_billing_date', today)
      .order('next_billing_date', { ascending: true })
      .limit(100);

    if (scheduleError) {
      results.errors.push(`Failed to fetch due schedules: ${scheduleError.message}`);
    } else if (dueSchedules) {
      for (const schedule of dueSchedules) {
        results.processed++;

        // Validate schedule
        if (!schedule.payment_profiles?.is_active) {
          results.skipped++;
          results.errors.push(`Schedule ${schedule.id}: Payment profile inactive`);
          continue;
        }

        if (schedule.enrollments?.status !== 'approved' && schedule.enrollments?.status !== 'active') {
          results.skipped++;
          continue;
        }

        try {
          const chargeResult = await processCharge(
            supabase,
            schedule,
            merchantAuth,
            apiEndpoint
          );

          if (chargeResult.success) {
            results.successful++;

            // Update schedule for next billing
            const nextDate = calculateNextBillingDate(
              new Date(),
              schedule.billing_day,
              schedule.frequency
            );

            await supabase
              .from('billing_schedules')
              .update({
                last_billed_date: today,
                next_billing_date: nextDate.toISOString().split('T')[0],
                retry_count: 0,
              })
              .eq('id', schedule.id);

            // Send receipt email
            if (schedule.members?.email) {
              await sendEmail(supabase, schedule.organization_id, {
                to: schedule.members.email,
                toName: `${schedule.members.first_name} ${schedule.members.last_name}`,
                templateSlug: 'payment_receipt',
                variables: {
                  member_name: `${schedule.members.first_name} ${schedule.members.last_name}`,
                  amount: `$${schedule.amount.toFixed(2)}`,
                  payment_date: new Date().toLocaleDateString(),
                  transaction_id: chargeResult.transactionId || '',
                },
                memberId: schedule.member_id,
                enrollmentId: schedule.enrollment_id,
              });
            }
          } else {
            results.failed++;

            // Handle retry logic
            const retryCount = (schedule.retry_count || 0) + 1;
            const maxRetries = 4;

            if (retryCount >= maxRetries) {
              // Max retries reached - pause schedule
              await supabase
                .from('billing_schedules')
                .update({
                  status: 'paused',
                  pause_reason: 'Max payment retries exceeded',
                  paused_at: new Date().toISOString(),
                })
                .eq('id', schedule.id);

              results.errors.push(
                `Schedule ${schedule.id}: Max retries exceeded - paused`
              );
            } else {
              // Schedule retry based on retry count
              const retryDays = [1, 3, 5, 7][retryCount - 1] || 7;
              const nextRetry = new Date();
              nextRetry.setDate(nextRetry.getDate() + retryDays);

              await supabase
                .from('billing_schedules')
                .update({
                  retry_count: retryCount,
                  next_billing_date: nextRetry.toISOString().split('T')[0],
                })
                .eq('id', schedule.id);
            }

            // Send failed payment email
            if (schedule.members?.email) {
              await sendEmail(supabase, schedule.organization_id, {
                to: schedule.members.email,
                toName: `${schedule.members.first_name} ${schedule.members.last_name}`,
                templateSlug: 'payment_failed',
                variables: {
                  member_name: `${schedule.members.first_name} ${schedule.members.last_name}`,
                  amount: `$${schedule.amount.toFixed(2)}`,
                  error_message: chargeResult.errorMessage || 'Payment declined',
                  retry_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString(),
                },
                memberId: schedule.member_id,
                enrollmentId: schedule.enrollment_id,
              });
            }
          }
        } catch (error) {
          results.failed++;
          results.errors.push(`Schedule ${schedule.id}: ${error.message}`);
        }
      }
    }

    // 2. Process billing failure retries
    const { data: failedRetries } = await supabase
      .from('billing_failures')
      .select(`
        *,
        billing_schedules (
          *,
          payment_profiles (
            id,
            authorize_customer_profile_id,
            authorize_payment_profile_id,
            is_active
          )
        )
      `)
      .eq('status', 'pending')
      .lte('next_retry_at', new Date().toISOString())
      .lt('retry_count', 4)
      .order('next_retry_at', { ascending: true })
      .limit(50);

    if (failedRetries) {
      for (const failure of failedRetries) {
        if (!failure.billing_schedules?.payment_profiles?.is_active) {
          continue;
        }

        results.processed++;

        try {
          const chargeResult = await processCharge(
            supabase,
            failure.billing_schedules,
            merchantAuth,
            apiEndpoint
          );

          if (chargeResult.success) {
            results.successful++;

            // Mark failure as resolved
            await supabase
              .from('billing_failures')
              .update({
                status: 'resolved',
                resolved_at: new Date().toISOString(),
                resolution_transaction_id: chargeResult.transactionId,
              })
              .eq('id', failure.id);

            // Reset schedule retry count
            await supabase
              .from('billing_schedules')
              .update({
                retry_count: 0,
                last_billed_date: today,
              })
              .eq('id', failure.billing_schedule_id);
          } else {
            results.failed++;

            // Update failure record
            const nextRetry = new Date();
            nextRetry.setDate(nextRetry.getDate() + 3);

            await supabase
              .from('billing_failures')
              .update({
                retry_count: (failure.retry_count || 0) + 1,
                last_retry_at: new Date().toISOString(),
                next_retry_at: nextRetry.toISOString(),
                last_error: chargeResult.errorMessage,
              })
              .eq('id', failure.id);
          }
        } catch (error) {
          results.failed++;
          results.errors.push(`Failure retry ${failure.id}: ${error.message}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        processedAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Billing processing error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function processCharge(
  supabase: any,
  schedule: any,
  merchantAuth: { name: string; transactionKey: string },
  apiEndpoint: string
): Promise<{ success: boolean; transactionId?: string; errorMessage?: string }> {
  const profile = schedule.payment_profiles;

  // Create transaction record
  const { data: transaction } = await supabase
    .from('billing_transactions')
    .insert({
      organization_id: schedule.organization_id,
      billing_schedule_id: schedule.id,
      member_id: schedule.member_id,
      enrollment_id: schedule.enrollment_id,
      payment_profile_id: profile.id,
      transaction_type: 'charge',
      amount: schedule.amount,
      status: 'processing',
      description: `Recurring payment - ${schedule.frequency}`,
      submitted_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  // Charge via Authorize.Net
  const chargeResponse = await fetch(apiEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      createTransactionRequest: {
        merchantAuthentication: merchantAuth,
        transactionRequest: {
          transactionType: 'authCaptureTransaction',
          amount: schedule.amount.toFixed(2),
          profile: {
            customerProfileId: profile.authorize_customer_profile_id,
            paymentProfile: {
              paymentProfileId: profile.authorize_payment_profile_id,
            },
          },
          order: {
            description: `Recurring payment - ${schedule.frequency}`,
          },
        },
      },
    }),
  });

  const responseText = await chargeResponse.text();
  const response = JSON.parse(responseText.replace(/^\uFEFF/, ''));
  const txnResponse = response.transactionResponse;

  if (response.messages.resultCode === 'Ok' && txnResponse?.responseCode === '1') {
    await supabase
      .from('billing_transactions')
      .update({
        status: 'success',
        authorize_transaction_id: txnResponse.transId,
        authorize_response_code: txnResponse.responseCode,
        authorize_auth_code: txnResponse.authCode,
        processed_at: new Date().toISOString(),
      })
      .eq('id', transaction.id);

    return { success: true, transactionId: txnResponse.transId };
  } else {
    const error = txnResponse?.errors?.[0] || response.messages.message[0];
    const errorMessage = error?.errorText || error?.text || 'Payment failed';

    await supabase
      .from('billing_transactions')
      .update({
        status: 'failed',
        authorize_transaction_id: txnResponse?.transId,
        authorize_response_code: txnResponse?.responseCode,
        error_code: error?.errorCode || error?.code,
        error_message: errorMessage,
        processed_at: new Date().toISOString(),
      })
      .eq('id', transaction.id);

    // Create failure record
    await supabase.from('billing_failures').insert({
      organization_id: schedule.organization_id,
      billing_schedule_id: schedule.id,
      transaction_id: transaction.id,
      member_id: schedule.member_id,
      amount: schedule.amount,
      failure_reason: errorMessage,
      failure_code: error?.errorCode || error?.code,
      failed_at: new Date().toISOString(),
      status: 'pending',
      retry_count: 0,
      next_retry_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    return { success: false, errorMessage };
  }
}

async function sendEmail(
  supabase: any,
  organizationId: string,
  params: {
    to: string;
    toName?: string;
    templateSlug: string;
    variables: Record<string, string>;
    memberId?: string;
    enrollmentId?: string;
  }
) {
  try {
    // Get template
    const { data: template } = await supabase
      .from('email_templates')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('slug', params.templateSlug)
      .eq('is_active', true)
      .single();

    if (!template) return;

    // Get email settings
    const { data: settings } = await supabase
      .from('system_settings')
      .select('setting_key, setting_value')
      .eq('organization_id', organizationId)
      .in('setting_key', ['email_from_address', 'email_from_name']);

    const settingsMap = (settings || []).reduce((acc: any, s: any) => {
      acc[s.setting_key] = s.setting_value;
      return acc;
    }, {});

    const fromEmail = settingsMap['email_from_address'] || 'noreply@example.com';
    const fromName = settingsMap['email_from_name'] || 'CRM System';

    // Replace variables
    const subject = replaceVariables(template.subject, params.variables);
    const html = replaceVariables(template.body_html, params.variables);

    // Send via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) return;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: params.toName ? `${params.toName} <${params.to}>` : params.to,
        subject,
        html,
      }),
    });

    const result = await resendResponse.json();

    // Record sent email
    await supabase.from('sent_emails').insert({
      organization_id: organizationId,
      member_id: params.memberId,
      enrollment_id: params.enrollmentId,
      template_id: template.id,
      email_type: params.templateSlug,
      recipient_email: params.to,
      recipient_name: params.toName,
      subject,
      body_html: html,
      from_email: fromEmail,
      from_name: fromName,
      provider: 'resend',
      provider_message_id: result.id,
      status: result.id ? 'sent' : 'failed',
      sent_at: result.id ? new Date().toISOString() : null,
      metadata: { triggered_by: 'system', variables: params.variables },
    });
  } catch (error) {
    console.error('Failed to send email:', error);
  }
}

function replaceVariables(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? variables[key] : match;
  });
}

function calculateNextBillingDate(
  fromDate: Date,
  billingDay: number,
  frequency: string
): Date {
  const next = new Date(fromDate);

  switch (frequency) {
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'annual':
      next.setFullYear(next.getFullYear() + 1);
      break;
  }

  // Set to billing day
  next.setDate(Math.min(billingDay, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));

  return next;
}
