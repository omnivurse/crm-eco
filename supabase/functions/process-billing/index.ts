/**
 * Process Billing Edge Function — Production-Hardened
 *
 * Scheduled function to process recurring billing with enterprise safeguards:
 *   • Circuit Breaker — trips after N consecutive failures, auto-resets after cooldown
 *   • Rate Limiter — max N charges per minute to avoid Authorize.Net throttling
 *   • Batch processing — configurable batch size from billing_automation_config
 *   • Idempotency keys — prevents duplicate charges on retry
 *   • Job run auditing — writes to billing_job_runs at start/end
 *   • Structured logging — consistent [BILLING] prefix
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  authorizeInternalEdgeRequest,
  unauthorizedResponse,
} from '../_shared/cron-auth.ts';

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

// ── Circuit Breaker ──────────────────────────────────────────────────────────

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

class CircuitBreaker {
  private state: CircuitBreakerState = { failures: 0, lastFailure: 0, isOpen: false };
  private threshold: number;
  private cooldownMs: number;

  constructor(threshold = 5, cooldownSeconds = 300) {
    this.threshold = threshold;
    this.cooldownMs = cooldownSeconds * 1000;
  }

  canProceed(): boolean {
    if (!this.state.isOpen) return true;
    // Check if cooldown has elapsed (half-open state)
    if (Date.now() - this.state.lastFailure >= this.cooldownMs) {
      console.log('[BILLING] Circuit breaker: half-open, allowing test request');
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    this.state.failures = 0;
    this.state.isOpen = false;
  }

  recordFailure(): void {
    this.state.failures++;
    this.state.lastFailure = Date.now();
    if (this.state.failures >= this.threshold) {
      this.state.isOpen = true;
      console.log(`[BILLING] Circuit breaker OPEN after ${this.state.failures} consecutive failures. Cooldown: ${this.cooldownMs / 1000}s`);
    }
  }

  get isCircuitOpen(): boolean {
    return this.state.isOpen;
  }
}

// ── Rate Limiter ─────────────────────────────────────────────────────────────

class RateLimiter {
  private timestamps: number[] = [];
  private maxPerMinute: number;

  constructor(maxPerMinute = 30) {
    this.maxPerMinute = maxPerMinute;
  }

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    // Remove timestamps older than 1 minute
    this.timestamps = this.timestamps.filter(t => now - t < 60_000);

    if (this.timestamps.length >= this.maxPerMinute) {
      const oldest = this.timestamps[0];
      const waitMs = 60_000 - (now - oldest) + 100; // +100ms buffer
      console.log(`[BILLING] Rate limit reached (${this.maxPerMinute}/min). Waiting ${waitMs}ms`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }

    this.timestamps.push(Date.now());
  }
}

// ── Processing Types ─────────────────────────────────────────────────────────

interface ProcessingResult {
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  circuitBreakerTripped: boolean;
  errors: string[];
}

interface OrgConfig {
  batch_size: number;
  max_retries: number;
  circuit_breaker_threshold: number;
  circuit_breaker_cooldown: number;
  rate_limit_per_minute: number;
}

const DEFAULT_CONFIG: OrgConfig = {
  batch_size: 50,
  max_retries: 4,
  circuit_breaker_threshold: 5,
  circuit_breaker_cooldown: 300,
  rate_limit_per_minute: 30,
};

// ── Main Handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Fail closed. This function holds the service-role key (RLS bypassed) and
  // previously inspected no caller at all — it runs recurring charges across
  // organizations. The platform `verify_jwt` gate accepts the public anon key,
  // which ships in every browser bundle, so it authenticates nothing on its own.
  // Invoked by apps/admin /api/cron/process-billing via createServiceRoleClient(),
  // which forwards the service-role bearer this accepts.
  if (!authorizeInternalEdgeRequest(req)) return unauthorizedResponse(corsHeaders);

  const startTime = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse optional body for org-specific runs
    let targetOrgId: string | null = null;
    let triggeredBy = 'cron';
    try {
      const body = await req.json();
      targetOrgId = body?.organization_id || null;
      triggeredBy = body?.triggered_by || 'cron';
    } catch {
      // No body = process all orgs
    }

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

    // Load org-specific config (or defaults)
    let orgConfig = DEFAULT_CONFIG;
    if (targetOrgId) {
      const { data: config } = await supabase
        .from('billing_automation_config')
        .select('batch_size, max_retries, circuit_breaker_threshold, circuit_breaker_cooldown, rate_limit_per_minute')
        .eq('organization_id', targetOrgId)
        .single();

      if (config) {
        orgConfig = config as OrgConfig;
      }
    }

    // Initialize safeguards
    const circuitBreaker = new CircuitBreaker(orgConfig.circuit_breaker_threshold, orgConfig.circuit_breaker_cooldown);
    const rateLimiter = new RateLimiter(orgConfig.rate_limit_per_minute);

    // Create job run record
    const { data: jobRun } = await supabase
      .from('billing_job_runs')
      .insert({
        organization_id: targetOrgId || '00000000-0000-0000-0000-000000000000',
        job_type: 'billing',
        status: 'running',
        triggered_by: triggeredBy,
        metadata: { environment, batch_size: orgConfig.batch_size },
      })
      .select('id')
      .single();

    const jobRunId = jobRun?.id;
    console.log(`[BILLING] Job ${jobRunId} started. Org: ${targetOrgId || 'ALL'}. Env: ${environment}`);

    const results: ProcessingResult = {
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      circuitBreakerTripped: false,
      errors: [],
    };

    // ── 1. Process due billing schedules ──────────────────────────────────

    let scheduleQuery = supabase
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
      .limit(orgConfig.batch_size);

    if (targetOrgId) {
      scheduleQuery = scheduleQuery.eq('organization_id', targetOrgId);
    }

    const { data: dueSchedules, error: scheduleError } = await scheduleQuery;

    if (scheduleError) {
      results.errors.push(`Failed to fetch due schedules: ${scheduleError.message}`);
      console.error(`[BILLING] ${results.errors[results.errors.length - 1]}`);
    } else if (dueSchedules) {
      console.log(`[BILLING] Found ${dueSchedules.length} due schedules`);

      for (const schedule of dueSchedules) {
        // Check circuit breaker
        if (!circuitBreaker.canProceed()) {
          results.circuitBreakerTripped = true;
          results.skipped += dueSchedules.length - results.processed;
          console.log(`[BILLING] Circuit breaker OPEN — skipping remaining ${dueSchedules.length - results.processed} schedules`);
          break;
        }

        results.processed++;

        // Validate schedule
        if (!schedule.payment_profiles?.is_active) {
          results.skipped++;
          results.errors.push(`Schedule ${schedule.id}: Payment profile inactive`);
          console.log(`[BILLING] Schedule ${schedule.id}: SKIP — payment profile inactive`);
          continue;
        }

        if (schedule.enrollments?.status !== 'approved' && schedule.enrollments?.status !== 'active') {
          results.skipped++;
          console.log(`[BILLING] Schedule ${schedule.id}: SKIP — enrollment status: ${schedule.enrollments?.status}`);
          continue;
        }

        // Check idempotency — skip if already charged today for this schedule
        const idempotencyKey = `${schedule.id}:${today}`;
        const { data: existingCharge } = await supabase
          .from('billing_transactions')
          .select('id')
          .eq('idempotency_key', idempotencyKey)
          .limit(1);

        if (existingCharge && existingCharge.length > 0) {
          results.skipped++;
          console.log(`[BILLING] Schedule ${schedule.id}: SKIP — already charged today (idempotency)`);
          continue;
        }

        try {
          // Wait for rate limiter slot
          await rateLimiter.waitForSlot();

          const chargeResult = await processCharge(
            supabase,
            schedule,
            merchantAuth,
            apiEndpoint,
            idempotencyKey
          );

          if (chargeResult.success) {
            results.successful++;
            circuitBreaker.recordSuccess();

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

            console.log(`[BILLING] Schedule ${schedule.id}: SUCCESS — txn ${chargeResult.transactionId}`);

            // Send receipt email (non-blocking)
            if (schedule.members?.email) {
              sendEmail(supabase, schedule.organization_id, {
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
              }).catch(err => {
                results.errors.push(`Schedule ${schedule.id}: Receipt email failed: ${err.message}`);
              });
            }
          } else {
            results.failed++;
            circuitBreaker.recordFailure();
            console.log(`[BILLING] Schedule ${schedule.id}: FAILED — ${chargeResult.errorMessage}`);

            // Handle retry logic
            const retryCount = (schedule.retry_count || 0) + 1;

            if (retryCount >= orgConfig.max_retries) {
              await supabase
                .from('billing_schedules')
                .update({
                  status: 'paused',
                  pause_reason: 'Max payment retries exceeded',
                  paused_at: new Date().toISOString(),
                })
                .eq('id', schedule.id);

              results.errors.push(`Schedule ${schedule.id}: Max retries exceeded — paused`);
            } else {
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

            // Send failed payment email (non-blocking)
            if (schedule.members?.email) {
              sendEmail(supabase, schedule.organization_id, {
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
              }).catch(err => {
                results.errors.push(`Schedule ${schedule.id}: Failed payment email also failed: ${err.message}`);
              });
            }
          }
        } catch (error) {
          results.failed++;
          circuitBreaker.recordFailure();
          const msg = error instanceof Error ? error.message : String(error);
          results.errors.push(`Schedule ${schedule.id}: ${msg}`);
          console.error(`[BILLING] Schedule ${schedule.id}: ERROR — ${msg}`);
        }
      }
    }

    // ── 2. Process billing failure retries ────────────────────────────────

    if (circuitBreaker.canProceed()) {
      let failureQuery = supabase
        .from('billing_failures')
        .select(`
          *,
          billing_schedules!billing_failures_billing_schedule_id_fkey (
            *,
            payment_profiles!billing_schedules_payment_profile_id_fkey (
              id,
              authorize_customer_profile_id,
              authorize_payment_profile_id,
              is_active
            )
          )
        `)
        .eq('status', 'pending')
        .lte('next_retry_at', new Date().toISOString())
        .lt('retry_count', orgConfig.max_retries)
        .order('next_retry_at', { ascending: true })
        .limit(Math.floor(orgConfig.batch_size / 2));

      if (targetOrgId) {
        failureQuery = failureQuery.eq('organization_id', targetOrgId);
      }

      const { data: failedRetries } = await failureQuery;

      if (failedRetries) {
        console.log(`[BILLING] Found ${failedRetries.length} failure retries`);

        for (const failure of failedRetries) {
          if (!circuitBreaker.canProceed()) {
            results.circuitBreakerTripped = true;
            break;
          }

          if (!failure.billing_schedules?.payment_profiles?.is_active) {
            continue;
          }

          results.processed++;

          try {
            await rateLimiter.waitForSlot();

            const chargeResult = await processCharge(
              supabase,
              failure.billing_schedules,
              merchantAuth,
              apiEndpoint
            );

            if (chargeResult.success) {
              results.successful++;
              circuitBreaker.recordSuccess();

              await supabase
                .from('billing_failures')
                .update({
                  status: 'resolved',
                  resolved_at: new Date().toISOString(),
                  resolution_transaction_id: chargeResult.transactionId,
                })
                .eq('id', failure.id);

              await supabase
                .from('billing_schedules')
                .update({
                  retry_count: 0,
                  last_billed_date: today,
                })
                .eq('id', failure.billing_schedule_id);

              console.log(`[BILLING] Failure ${failure.id}: RESOLVED — txn ${chargeResult.transactionId}`);
            } else {
              results.failed++;
              circuitBreaker.recordFailure();

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
            circuitBreaker.recordFailure();
            const msg = error instanceof Error ? error.message : String(error);
            results.errors.push(`Failure retry ${failure.id}: ${msg}`);
            console.error(`[BILLING] Failure ${failure.id}: ERROR — ${msg}`);
          }
        }
      }
    }

    // ── 3. Update job run record ─────────────────────────────────────────

    const durationMs = Date.now() - startTime;
    if (jobRunId) {
      await supabase
        .from('billing_job_runs')
        .update({
          status: results.errors.length > 0 && results.successful === 0 ? 'failed' : 'completed',
          completed_at: new Date().toISOString(),
          duration_ms: durationMs,
          processed_count: results.processed,
          success_count: results.successful,
          failure_count: results.failed,
          skipped_count: results.skipped,
          error_log: results.errors.length > 0 ? results.errors : [],
          metadata: {
            environment,
            batch_size: orgConfig.batch_size,
            circuit_breaker_tripped: results.circuitBreakerTripped,
          },
        })
        .eq('id', jobRunId);
    }

    console.log(`[BILLING] Job ${jobRunId} completed in ${durationMs}ms. ` +
      `Processed: ${results.processed}, Success: ${results.successful}, ` +
      `Failed: ${results.failed}, Skipped: ${results.skipped}`);

    return new Response(
      JSON.stringify({
        success: true,
        jobRunId,
        results,
        durationMs,
        processedAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[BILLING] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});

// ── Charge Processing ────────────────────────────────────────────────────────

async function processCharge(
  supabase: any,
  schedule: any,
  merchantAuth: { name: string; transactionKey: string },
  apiEndpoint: string,
  idempotencyKey?: string,
): Promise<{ success: boolean; transactionId?: string; errorMessage?: string }> {
  const profile = schedule.payment_profiles;

  // Create transaction record with idempotency key
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
      idempotency_key: idempotencyKey || null,
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

// ── Email Sending ────────────────────────────────────────────────────────────

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
): Promise<{ sent: boolean; error?: string }> {
  try {
    // Get template
    const { data: template } = await supabase
      .from('email_templates')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('slug', params.templateSlug)
      .eq('is_active', true)
      .single();

    if (!template) {
      const msg = `Missing email template '${params.templateSlug}' for org ${organizationId}. Billing email NOT sent to ${params.to}.`;
      console.error(`[BILLING EMAIL] CRITICAL: ${msg}`);
      return { sent: false, error: msg };
    }

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

    const fromEmail = settingsMap['email_from_address'] || Deno.env.get('FROM_EMAIL');
    if (!fromEmail) {
      const msg = `No email_from_address in settings and FROM_EMAIL env var not set. Billing email NOT sent to ${params.to}.`;
      console.error(`[BILLING EMAIL] CRITICAL: ${msg}`);
      return { sent: false, error: msg };
    }
    const fromName = settingsMap['email_from_name'] || 'CRM System';

    // Replace variables
    const subject = replaceVariables(template.subject, params.variables);
    const html = replaceVariables(template.body_html, params.variables);

    // Send via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      const msg = `RESEND_API_KEY not configured. Billing email NOT sent to ${params.to}.`;
      console.error(`[BILLING EMAIL] CRITICAL: ${msg}`);
      return { sent: false, error: msg };
    }

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
    const emailSent = !!result.id;

    if (!emailSent) {
      console.error(`[BILLING EMAIL] Resend API error for ${params.to}: ${result.message || JSON.stringify(result)}`);
    }

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
      status: emailSent ? 'sent' : 'failed',
      error_message: emailSent ? null : (result.message || 'Resend API error'),
      sent_at: emailSent ? new Date().toISOString() : null,
      metadata: { triggered_by: 'system', variables: params.variables },
    });

    return { sent: emailSent, error: emailSent ? undefined : (result.message || 'Resend API error') };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[BILLING EMAIL] Failed to send email to ${params.to}:`, msg);
    return { sent: false, error: msg };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function replaceVariables(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? escapeHtml(variables[key]) : match;
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
