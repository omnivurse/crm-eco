/**
 * Billing Retry Edge Function — Dunning Loop
 *
 * Dedicated retry processor for billing_failures rows that were not
 * resolved during the main process-billing run. Implements the dunning
 * sequence (attempt 1 / 2 / 3 → abandoned) and dispatches member
 * notifications via Resend at each step.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '*').split(',').map(s => s.trim());

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  const allowed = ALLOWED_ORIGINS.includes('*') ? '*' :
    (ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

const RETRY_SCHEDULE = [
  { attempt: 1, daysAfterFailure: 1,  template: 'payment_failed_attempt_1' },
  { attempt: 2, daysAfterFailure: 4,  template: 'payment_failed_attempt_2' },
  { attempt: 3, daysAfterFailure: 7,  template: 'payment_failed_attempt_3' },
  { attempt: 4, daysAfterFailure: 14, template: 'payment_abandoned' },
];

interface RetryResult {
  failure_id: string;
  status: 'retried' | 'abandoned' | 'skipped' | 'error';
  attempt: number;
  message?: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const { organization_id } = await req.json();
    if (!organization_id) {
      return new Response(JSON.stringify({ error: 'organization_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[BILLING-RETRY] Starting retry sweep for org ${organization_id}`);

    const jobRunId = await startJobRun(supabase, organization_id);

    const { data: failures, error: failError } = await supabase
      .from('billing_failures')
      .select(`
        id, organization_id, billing_schedule_id, retry_count, first_failed_at, last_attempted_at,
        error_message, member_id,
        billing_schedules!billing_failures_billing_schedule_id_fkey!inner(
          *,
          payment_profiles!billing_schedules_payment_profile_id_fkey(*)
        ),
        members!billing_failures_member_id_fkey(id, email, first_name, last_name)
      `)
      .eq('organization_id', organization_id)
      .eq('resolved', false)
      .lt('retry_count', RETRY_SCHEDULE.length);

    if (failError) {
      console.error('[BILLING-RETRY] Query error:', failError);
      await finishJobRun(supabase, jobRunId, 'failed', { error: failError.message });
      return new Response(JSON.stringify({ error: failError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const results: RetryResult[] = [];
    const merchantAuth = {
      name: Deno.env.get('AUTHNET_API_LOGIN_ID') || '',
      transactionKey: Deno.env.get('AUTHNET_TRANSACTION_KEY') || '',
    };
    const apiEndpoint = Deno.env.get('AUTHNET_API_ENDPOINT')
      || 'https://apitest.authorize.net/xml/v1/request.api';

    for (const failure of failures || []) {
      const nextAttempt = (failure.retry_count ?? 0) + 1;
      const schedule = RETRY_SCHEDULE[nextAttempt - 1];
      if (!schedule) {
        results.push({ failure_id: failure.id, status: 'skipped', attempt: nextAttempt });
        continue;
      }

      const dueDate = new Date(failure.first_failed_at as string);
      dueDate.setUTCDate(dueDate.getUTCDate() + schedule.daysAfterFailure);
      if (Date.now() < dueDate.getTime()) {
        results.push({ failure_id: failure.id, status: 'skipped', attempt: nextAttempt, message: 'Not yet due' });
        continue;
      }

      try {
        if (nextAttempt === RETRY_SCHEDULE.length) {
          await supabase
            .from('billing_failures')
            .update({
              retry_count: nextAttempt,
              last_attempted_at: new Date().toISOString(),
              status: 'abandoned',
            })
            .eq('id', failure.id);

          await sendDunningEmail(supabase, failure, schedule.template);
          results.push({ failure_id: failure.id, status: 'abandoned', attempt: nextAttempt });
          continue;
        }

        const charge = await processRetryCharge(supabase, failure.billing_schedules, merchantAuth, apiEndpoint);

        if (charge.success) {
          await supabase
            .from('billing_failures')
            .update({
              resolved: true,
              resolved_at: new Date().toISOString(),
              retry_count: nextAttempt,
              last_attempted_at: new Date().toISOString(),
            })
            .eq('id', failure.id);

          await sendDunningEmail(supabase, failure, 'payment_recovered');
          results.push({ failure_id: failure.id, status: 'retried', attempt: nextAttempt, message: 'recovered' });
        } else {
          await supabase
            .from('billing_failures')
            .update({
              retry_count: nextAttempt,
              last_attempted_at: new Date().toISOString(),
              error_message: charge.errorMessage ?? failure.error_message,
            })
            .eq('id', failure.id);

          await sendDunningEmail(supabase, failure, schedule.template);
          results.push({ failure_id: failure.id, status: 'retried', attempt: nextAttempt, message: charge.errorMessage });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[BILLING-RETRY] Failure ${failure.id} retry error:`, message);
        results.push({ failure_id: failure.id, status: 'error', attempt: nextAttempt, message });
      }
    }

    const summary = {
      total: failures?.length ?? 0,
      retried: results.filter(r => r.status === 'retried').length,
      abandoned: results.filter(r => r.status === 'abandoned').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      errored: results.filter(r => r.status === 'error').length,
    };

    await finishJobRun(supabase, jobRunId, 'completed', summary);

    return new Response(
      JSON.stringify({ summary, processed: summary.retried + summary.abandoned, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[BILLING-RETRY] Fatal:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

async function startJobRun(supabase: any, organizationId: string) {
  const { data } = await supabase
    .from('billing_job_runs')
    .insert({
      organization_id: organizationId,
      job_type: 'billing_retry',
      status: 'running',
      started_at: new Date().toISOString(),
      triggered_by: 'edge_function',
    })
    .select('id')
    .single();
  return data?.id as string | undefined;
}

async function finishJobRun(supabase: any, id: string | undefined, status: string, metadata: Record<string, unknown>) {
  if (!id) return;
  await supabase
    .from('billing_job_runs')
    .update({
      status,
      completed_at: new Date().toISOString(),
      metadata,
    })
    .eq('id', id);
}

async function processRetryCharge(
  supabase: any,
  schedule: any,
  merchantAuth: { name: string; transactionKey: string },
  apiEndpoint: string,
): Promise<{ success: boolean; transactionId?: string; errorMessage?: string }> {
  const profile = schedule.payment_profiles;
  if (!profile) return { success: false, errorMessage: 'No payment profile' };

  const { data: transaction } = await supabase
    .from('billing_transactions')
    .insert({
      organization_id: schedule.organization_id,
      billing_schedule_id: schedule.id,
      member_id: schedule.member_id,
      enrollment_id: schedule.enrollment_id,
      payment_profile_id: profile.id,
      transaction_type: 'retry_charge',
      amount: schedule.amount,
      status: 'processing',
      description: `Retry charge - ${schedule.frequency}`,
      submitted_at: new Date().toISOString(),
      idempotency_key: `retry_${schedule.id}_${Date.now()}`,
    })
    .select('id')
    .single();

  try {
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        createTransactionRequest: {
          merchantAuthentication: merchantAuth,
          transactionRequest: {
            transactionType: 'authCaptureTransaction',
            amount: Number(schedule.amount).toFixed(2),
            profile: {
              customerProfileId: profile.authorize_customer_profile_id,
              paymentProfile: { paymentProfileId: profile.authorize_payment_profile_id },
            },
            order: { description: `Retry charge - ${schedule.frequency}` },
          },
        },
      }),
    });

    const text = await response.text();
    const data = JSON.parse(text.replace(/^\uFEFF/, ''));
    const txn = data.transactionResponse;

    if (data.messages.resultCode === 'Ok' && txn?.responseCode === '1') {
      await supabase
        .from('billing_transactions')
        .update({
          status: 'success',
          authorize_transaction_id: txn.transId,
          authorize_response_code: txn.responseCode,
          processed_at: new Date().toISOString(),
        })
        .eq('id', transaction.id);
      return { success: true, transactionId: txn.transId };
    }

    const errInfo = txn?.errors?.[0] || data.messages.message?.[0];
    const errorMessage = errInfo?.errorText || errInfo?.text || 'Retry failed';

    await supabase
      .from('billing_transactions')
      .update({
        status: 'failed',
        error_message: errorMessage,
        processed_at: new Date().toISOString(),
      })
      .eq('id', transaction.id);

    return { success: false, errorMessage };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await supabase
      .from('billing_transactions')
      .update({ status: 'failed', error_message: message, processed_at: new Date().toISOString() })
      .eq('id', transaction.id);
    return { success: false, errorMessage: message };
  }
}

async function sendDunningEmail(supabase: any, failure: any, template: string) {
  try {
    const member = failure.members;
    if (!member?.email) return;

    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) {
      console.warn('[BILLING-RETRY] RESEND_API_KEY missing — skipping email');
      return;
    }

    const { data: tmpl } = await supabase
      .from('email_templates')
      .select('subject, html_body')
      .eq('organization_id', failure.organization_id)
      .eq('template_key', template)
      .eq('is_active', true)
      .maybeSingle();

    const subject = tmpl?.subject ?? defaultSubject(template);
    const html = tmpl?.html_body ?? defaultBody(template, member);

    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'noreply@example.com';
    const fromName = Deno.env.get('RESEND_FROM_NAME') || 'Billing';

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: member.email,
        subject,
        html,
      }),
    });
  } catch (err) {
    console.warn('[BILLING-RETRY] Email send failed:', err);
  }
}

function defaultSubject(template: string): string {
  switch (template) {
    case 'payment_failed_attempt_1': return 'Action Needed: Your Payment Could Not Be Processed';
    case 'payment_failed_attempt_2': return 'Reminder: Please Update Your Payment Method';
    case 'payment_failed_attempt_3': return 'Final Notice: Your Membership Is At Risk';
    case 'payment_abandoned':        return 'Membership Suspended Due to Non-Payment';
    case 'payment_recovered':        return 'Thank You — Your Payment Was Successful';
    default:                         return 'Important: Payment Update Required';
  }
}

function defaultBody(template: string, member: { first_name?: string }): string {
  const name = member.first_name ?? 'there';
  switch (template) {
    case 'payment_failed_attempt_1':
      return `<p>Hi ${name},</p><p>We were unable to process your monthly contribution. We'll automatically retry in 3 days. Please ensure your payment method on file is up to date.</p>`;
    case 'payment_failed_attempt_2':
      return `<p>Hi ${name},</p><p>This is your second reminder that we have not been able to process your monthly contribution. Please log in and update your payment method to avoid interruption to your membership.</p>`;
    case 'payment_failed_attempt_3':
      return `<p>Hi ${name},</p><p>This is a final notice — your membership will be suspended in 7 days if your payment cannot be processed. Please update your payment method immediately.</p>`;
    case 'payment_abandoned':
      return `<p>Hi ${name},</p><p>Your membership has been suspended due to non-payment. To reactivate, please contact us.</p>`;
    case 'payment_recovered':
      return `<p>Hi ${name},</p><p>Good news — your payment was successfully processed. Thank you for being part of our community.</p>`;
    default:
      return `<p>Hi ${name},</p><p>Please review your billing details.</p>`;
  }
}
