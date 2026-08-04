/**
 * Process Commissions Edge Function
 *
 * Calculates commissions for billing transactions that have not yet been
 * commissioned.  For each successful billing transaction:
 *   1. Looks up the enrollment's advisor and their commission tier.
 *   2. Creates a direct commission_transaction (base_rate_pct).
 *   3. Walks the advisor upline chain (via `get_advisor_upline` RPC) and
 *      creates override commission_transactions for eligible ancestors.
 *   4. Marks the billing_transaction as commissioned (commissioned_at).
 *
 * Deduplication: every commission row carries an idempotency_key of the form
 *   {enrollment_id}:{transaction_type}:{YYYY-MM}
 * with an ON CONFLICT … DO NOTHING guard.
 *
 * Audit: each run creates/updates a billing_job_runs row (job_type='commission').
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  authorizeInternalEdgeRequest,
  unauthorizedResponse,
} from '../_shared/cron-auth.ts';

// ─── CORS ────────────────────────────────────────────────────────────────────

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

// ─── Types ───────────────────────────────────────────────────────────────────

interface CommissionTier {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  level: number;
  base_rate_pct: number;
  bonus_rate_pct: number | null;
  override_rate_pct: number | null;
  is_active: boolean;
}

interface UplineRow {
  level: number;
  advisor_id: string;
  parent_advisor_id: string | null;
  commission_eligible: boolean | null;
  commission_tier_id: string | null;
}

interface OrgResult {
  organization_id: string;
  total_eligible: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  direct_commissions_created: number;
  override_commissions_created: number;
  errors: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format a Date into YYYY-MM for the idempotency key. */
function yearMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Current period boundaries (first and last day of the current month). */
function currentPeriod(): { periodStart: string; periodEnd: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    periodStart: start.toISOString().split('T')[0],
    periodEnd: end.toISOString().split('T')[0],
  };
}

// ─── Main handler ────────────────────────────────────────────────────────────

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Fail closed. Service-role key (RLS bypassed), no caller check previously —
  // it writes commission_transactions across organizations. `verify_jwt` accepts
  // the public anon key, so it authenticates nothing on its own. Invoked by
  // apps/admin /api/cron/{process-commissions,commissions-accrual} via
  // createServiceRoleClient(), which forwards the bearer this accepts.
  if (!authorizeInternalEdgeRequest(req)) return unauthorizedResponse(corsHeaders);

  const headers = { ...corsHeaders, 'Content-Type': 'application/json' };

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // ── Parse request body ──────────────────────────────────────────────

    let requestedOrgId: string | undefined;
    try {
      const body = await req.json();
      requestedOrgId = body?.organization_id;
    } catch {
      // No body or invalid JSON — process all enabled orgs.
    }

    // ── Determine which orgs to process ─────────────────────────────────

    let orgIds: string[] = [];

    if (requestedOrgId) {
      orgIds = [requestedOrgId];
      console.log(`[COMMISSION] Manual trigger for org ${requestedOrgId}`);
    } else {
      const { data: configs, error: cfgErr } = await supabase
        .from('billing_automation_config')
        .select('organization_id')
        .eq('commission_enabled', true);

      if (cfgErr) {
        console.error('[COMMISSION] Failed to fetch automation configs:', cfgErr.message);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch automation configs', detail: cfgErr.message }),
          { status: 500, headers },
        );
      }

      orgIds = (configs || []).map((c: { organization_id: string }) => c.organization_id);
      console.log(`[COMMISSION] Auto-run: ${orgIds.length} org(s) with commission_enabled=true`);
    }

    if (orgIds.length === 0) {
      console.log('[COMMISSION] No organizations to process. Exiting.');
      return new Response(
        JSON.stringify({ success: true, message: 'No organizations to process', results: [] }),
        { headers },
      );
    }

    // ── Process each org ────────────────────────────────────────────────

    const allResults: OrgResult[] = [];

    for (const orgId of orgIds) {
      const result = await processOrgCommissions(supabase, orgId);
      allResults.push(result);
    }

    const summary = {
      success: true,
      processedAt: new Date().toISOString(),
      organizationsProcessed: allResults.length,
      totals: {
        eligible: allResults.reduce((s, r) => s + r.total_eligible, 0),
        processed: allResults.reduce((s, r) => s + r.processed, 0),
        succeeded: allResults.reduce((s, r) => s + r.succeeded, 0),
        failed: allResults.reduce((s, r) => s + r.failed, 0),
        skipped: allResults.reduce((s, r) => s + r.skipped, 0),
        directCommissions: allResults.reduce((s, r) => s + r.direct_commissions_created, 0),
        overrideCommissions: allResults.reduce((s, r) => s + r.override_commissions_created, 0),
      },
      results: allResults,
    };

    console.log('[COMMISSION] Run complete:', JSON.stringify(summary.totals));
    return new Response(JSON.stringify(summary), { headers });

  } catch (error) {
    console.error('[COMMISSION] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers },
    );
  }
});

// ─── Per-org processing ──────────────────────────────────────────────────────

async function processOrgCommissions(supabase: any, orgId: string): Promise<OrgResult> {
  const startTime = Date.now();

  const result: OrgResult = {
    organization_id: orgId,
    total_eligible: 0,
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    direct_commissions_created: 0,
    override_commissions_created: 0,
    errors: [],
  };

  // ── Create audit row ────────────────────────────────────────────────

  const { data: jobRun, error: jobErr } = await supabase
    .from('billing_job_runs')
    .insert({
      organization_id: orgId,
      job_type: 'commission',
      status: 'running',
      triggered_by: 'api',
    })
    .select('id')
    .single();

  if (jobErr) {
    console.error(`[COMMISSION] [${orgId}] Failed to create job run:`, jobErr.message);
    result.errors.push(`Job run creation failed: ${jobErr.message}`);
    // Continue processing even if audit row fails.
  }

  const jobRunId: string | null = jobRun?.id ?? null;

  try {
    // ── Fetch uncommissioned billing transactions ───────────────────

    const { data: txns, error: txnErr } = await supabase
      .from('billing_transactions')
      .select('id, organization_id, member_id, enrollment_id, amount, status, processed_at')
      .eq('organization_id', orgId)
      .eq('status', 'success')
      .is('commissioned_at', null)
      .order('processed_at', { ascending: true })
      .limit(500);

    if (txnErr) {
      const msg = `Failed to fetch uncommissioned transactions: ${txnErr.message}`;
      console.error(`[COMMISSION] [${orgId}] ${msg}`);
      result.errors.push(msg);
      await finalizeJobRun(supabase, jobRunId, 'failed', result, startTime);
      return result;
    }

    const billingTxns = txns || [];
    result.total_eligible = billingTxns.length;
    console.log(`[COMMISSION] [${orgId}] Found ${billingTxns.length} uncommissioned transaction(s)`);

    if (billingTxns.length === 0) {
      await finalizeJobRun(supabase, jobRunId, 'completed', result, startTime);
      return result;
    }

    // ── Pre-load advisor & tier data for this org ───────────────────
    // Reduces N+1 queries during the per-txn loop.

    const { data: advisorsRaw } = await supabase
      .from('advisors')
      .select('id, commission_tier_id, parent_advisor_id, commission_eligible')
      .eq('organization_id', orgId);

    const advisorMap = new Map<string, {
      id: string;
      commission_tier_id: string | null;
      parent_advisor_id: string | null;
      commission_eligible: boolean | null;
    }>();
    for (const a of advisorsRaw || []) {
      advisorMap.set(a.id, a);
    }

    // Load all active tiers for this org
    const { data: tiersRaw } = await supabase
      .from('commission_tiers')
      .select('*')
      .eq('organization_id', orgId)
      .eq('is_active', true);

    const tierMap = new Map<string, CommissionTier>();
    for (const t of tiersRaw || []) {
      tierMap.set(t.id, t as CommissionTier);
    }

    // ── Batch-load enrollments for all transactions ─────────────────

    const enrollmentIds = [
      ...new Set(billingTxns.map((t: any) => t.enrollment_id).filter(Boolean)),
    ];

    const enrollmentAdvisorMap = new Map<string, { advisor_id: string; member_id: string }>();
    if (enrollmentIds.length > 0) {
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('id, advisor_id, member_id, status')
        .in('id', enrollmentIds)
        .in('status', ['approved', 'active']);

      for (const e of enrollments || []) {
        if (e.advisor_id) {
          enrollmentAdvisorMap.set(e.id, { advisor_id: e.advisor_id, member_id: e.member_id });
        }
      }
    }

    // ── Process each billing transaction ────────────────────────────

    const { periodStart, periodEnd } = currentPeriod();
    const ym = yearMonth(new Date());

    for (const btx of billingTxns) {
      result.processed++;

      try {
        // Skip if no enrollment
        if (!btx.enrollment_id) {
          result.skipped++;
          result.errors.push(`Txn ${btx.id}: no enrollment_id — skipped`);
          continue;
        }

        const enrollment = enrollmentAdvisorMap.get(btx.enrollment_id);
        if (!enrollment) {
          result.skipped++;
          result.errors.push(`Txn ${btx.id}: enrollment ${btx.enrollment_id} not found or not approved/active — skipped`);
          continue;
        }

        const advisorId = enrollment.advisor_id;
        const advisor = advisorMap.get(advisorId);
        if (!advisor) {
          result.skipped++;
          result.errors.push(`Txn ${btx.id}: advisor ${advisorId} not found — skipped`);
          continue;
        }

        // ── Direct commission ─────────────────────────────────────

        let directCreated = false;

        if (advisor.commission_eligible) {
          const tier = advisor.commission_tier_id
            ? tierMap.get(advisor.commission_tier_id) ?? null
            : null;

          const ratePct = tier?.base_rate_pct ?? 0;
          const commissionAmount = (btx.amount * ratePct) / 100;

          if (commissionAmount > 0) {
            const idempotencyKey = `${btx.enrollment_id}:new_business:${ym}`;

            const { error: insErr } = await supabase
              .from('commission_transactions')
              .upsert(
                {
                  organization_id: orgId,
                  advisor_id: advisorId,
                  enrollment_id: btx.enrollment_id,
                  member_id: btx.member_id || enrollment.member_id || null,
                  transaction_type: 'new_business',
                  period_start: periodStart,
                  period_end: periodEnd,
                  gross_amount: btx.amount,
                  rate_pct: ratePct,
                  commission_amount: commissionAmount,
                  status: 'pending',
                  idempotency_key: idempotencyKey,
                  agent_level_at_time: tier?.name ?? null,
                },
                { onConflict: 'idempotency_key', ignoreDuplicates: true },
              );

            if (insErr) {
              console.error(`[COMMISSION] [${orgId}] Direct insert error for txn ${btx.id}:`, insErr.message);
              result.errors.push(`Txn ${btx.id}: direct commission insert failed — ${insErr.message}`);
            } else {
              directCreated = true;
              result.direct_commissions_created++;
              console.log(`[COMMISSION] [${orgId}] Direct commission: advisor=${advisorId}, amount=${commissionAmount.toFixed(2)}, rate=${ratePct}%`);
            }
          }
        }

        // ── Override commissions (upline chain) ───────────────────

        const overridesCreated = await processOverrides(
          supabase,
          orgId,
          btx,
          advisorId,
          enrollment.member_id,
          tierMap,
          periodStart,
          periodEnd,
          ym,
          result,
        );

        result.override_commissions_created += overridesCreated;

        // ── Mark billing txn as commissioned ──────────────────────

        const { error: markErr } = await supabase
          .from('billing_transactions')
          .update({ commissioned_at: new Date().toISOString() })
          .eq('id', btx.id);

        if (markErr) {
          console.error(`[COMMISSION] [${orgId}] Failed to mark txn ${btx.id} as commissioned:`, markErr.message);
          result.errors.push(`Txn ${btx.id}: commissioned_at update failed — ${markErr.message}`);
          result.failed++;
        } else {
          result.succeeded++;
        }

      } catch (txErr: any) {
        result.failed++;
        const msg = txErr?.message ?? String(txErr);
        console.error(`[COMMISSION] [${orgId}] Error processing txn ${btx.id}:`, msg);
        result.errors.push(`Txn ${btx.id}: ${msg}`);
      }
    }

    // ── Finalize audit row ──────────────────────────────────────────

    const status = result.failed > 0 && result.succeeded === 0 ? 'failed' : 'completed';
    await finalizeJobRun(supabase, jobRunId, status, result, startTime);

    console.log(
      `[COMMISSION] [${orgId}] Done: ${result.succeeded} succeeded, ${result.failed} failed, ` +
      `${result.skipped} skipped, ${result.direct_commissions_created} direct, ` +
      `${result.override_commissions_created} overrides`,
    );

  } catch (orgErr: any) {
    const msg = orgErr?.message ?? String(orgErr);
    console.error(`[COMMISSION] [${orgId}] Org-level error:`, msg);
    result.errors.push(`Org-level: ${msg}`);
    await finalizeJobRun(supabase, jobRunId, 'failed', result, startTime);
  }

  return result;
}

// ─── Override commission generation ──────────────────────────────────────────

async function processOverrides(
  supabase: any,
  orgId: string,
  btx: any,
  sourceAdvisorId: string,
  memberId: string | null,
  tierMap: Map<string, CommissionTier>,
  periodStart: string,
  periodEnd: string,
  ym: string,
  result: OrgResult,
): Promise<number> {
  const MAX_LEVELS = 5;
  let created = 0;

  try {
    const { data: uplineRaw, error: uplineErr } = await supabase.rpc(
      'get_advisor_upline',
      { p_advisor_id: sourceAdvisorId, p_max_levels: MAX_LEVELS },
    );

    if (uplineErr) {
      console.error(`[COMMISSION] [${orgId}] Upline RPC error for advisor ${sourceAdvisorId}:`, uplineErr.message);
      result.errors.push(`Txn ${btx.id}: upline RPC failed — ${uplineErr.message}`);
      return created;
    }

    const upline: UplineRow[] = (uplineRaw || []) as UplineRow[];
    const eligible = upline.filter(u => u.commission_eligible === true);

    if (eligible.length === 0) return created;

    for (const ancestor of eligible) {
      const tier = ancestor.commission_tier_id
        ? tierMap.get(ancestor.commission_tier_id) ?? null
        : null;

      const ratePct = tier?.override_rate_pct ?? 0;
      const commissionAmount = (btx.amount * ratePct) / 100;

      if (commissionAmount <= 0) continue;

      const idempotencyKey = `${btx.enrollment_id}:override_L${ancestor.level}:${ym}`;

      const { error: insErr } = await supabase
        .from('commission_transactions')
        .upsert(
          {
            organization_id: orgId,
            advisor_id: ancestor.advisor_id,
            enrollment_id: btx.enrollment_id,
            member_id: btx.member_id || memberId || null,
            transaction_type: 'override',
            period_start: periodStart,
            period_end: periodEnd,
            gross_amount: btx.amount,
            rate_pct: ratePct,
            commission_amount: commissionAmount,
            source_advisor_id: sourceAdvisorId,
            override_level: ancestor.level,
            status: 'pending',
            idempotency_key: idempotencyKey,
            agent_level_at_time: tier?.name ?? null,
          },
          { onConflict: 'idempotency_key', ignoreDuplicates: true },
        );

      if (insErr) {
        console.error(`[COMMISSION] [${orgId}] Override insert error for ancestor ${ancestor.advisor_id}:`, insErr.message);
        result.errors.push(`Txn ${btx.id}: override L${ancestor.level} insert failed — ${insErr.message}`);
      } else {
        created++;
        console.log(
          `[COMMISSION] [${orgId}] Override L${ancestor.level}: advisor=${ancestor.advisor_id}, ` +
          `amount=${commissionAmount.toFixed(2)}, rate=${ratePct}%`,
        );
      }
    }
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    console.error(`[COMMISSION] [${orgId}] Override processing error for txn ${btx.id}:`, msg);
    result.errors.push(`Txn ${btx.id}: override chain error — ${msg}`);
  }

  return created;
}

// ─── Audit finalization ──────────────────────────────────────────────────────

async function finalizeJobRun(
  supabase: any,
  jobRunId: string | null,
  status: 'completed' | 'failed',
  result: OrgResult,
  startTime: number,
): Promise<void> {
  if (!jobRunId) return;

  const durationMs = Date.now() - startTime;

  try {
    await supabase
      .from('billing_job_runs')
      .update({
        status,
        completed_at: new Date().toISOString(),
        duration_ms: durationMs,
        total_eligible: result.total_eligible,
        processed_count: result.processed,
        success_count: result.succeeded,
        failure_count: result.failed,
        skipped_count: result.skipped,
        error_log: result.errors.length > 0 ? result.errors : [],
        metadata: {
          direct_commissions_created: result.direct_commissions_created,
          override_commissions_created: result.override_commissions_created,
        },
      })
      .eq('id', jobRunId);
  } catch (err: any) {
    console.error(`[COMMISSION] Failed to finalize job run ${jobRunId}:`, err?.message ?? err);
  }
}
