import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createServerClient } from '@supabase/ssr';
import {
  processPendingCadenceSteps,
  processScheduledJobs,
  processScheduledWorkflows,
} from '@/lib/automation';

function verifyCronSecret(request: NextRequest): NextResponse | null {
  const authHeader = request.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('[automation/cron] CRON_SECRET env var is not configured — rejecting request');
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  const expected = Buffer.from(`Bearer ${cronSecret}`);
  const actual = Buffer.from(authHeader);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

/**
 * Creates a service role client for cron operations
 */
function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return []; },
        setAll() {},
      },
    }
  );
}

/**
 * POST /api/automation/cron
 * Process scheduled automation tasks:
 * - Pending cadence steps
 * - SLA escalations (future)
 * - Scheduled workflows (future)
 * 
 * Should be called by an external cron job (e.g., Vercel cron, GitHub Actions)
 * Secured by CRON_SECRET environment variable
 */
export async function POST(request: NextRequest) {
  try {
    const authFailure = verifyCronSecret(request);
    if (authFailure) return authFailure;

    const results: Record<string, unknown> = {};

    // 1. Process pending cadence steps
    try {
      const cadenceResults = await processPendingCadenceSteps();
      results.cadences = cadenceResults;
    } catch (error) {
      results.cadences = {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // 2. Process scheduler jobs (delayed steps, retries, etc.)
    try {
      const schedulerResults = await processScheduledJobs(100);
      results.schedulerJobs = {
        processed: schedulerResults.processed,
        completed: schedulerResults.completed,
        failed: schedulerResults.failed,
        retrying: schedulerResults.retrying,
      };
    } catch (error) {
      results.schedulerJobs = {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // 3. Process scheduled workflows (cron-like)
    try {
      const workflowResults = await processScheduledWorkflows();
      results.scheduledWorkflows = workflowResults;
    } catch (error) {
      results.scheduledWorkflows = {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // 4. Auto-create weekly payout batches (runs every invocation;
    //    the DB function is idempotent — skips orgs that already have a batch)
    try {
      const supabase = createServiceClient();
      const { data: payoutResult, error: payoutError } = await supabase
        .rpc('auto_create_weekly_batches');
      if (payoutError) throw payoutError;
      results.weeklyPayoutBatches = payoutResult;
    } catch (error) {
      results.weeklyPayoutBatches = {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // 5. Auto-cancel records whose cancellation_date has passed
    try {
      const supabase = createServiceClient();
      const { data: cancelResult, error: cancelError } = await supabase
        .rpc('auto_cancel_expired_records');
      if (cancelError) throw cancelError;
      results.autoCancelled = cancelResult;
    } catch (error) {
      results.autoCancelled = {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error) {
    console.error('Cron processing error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/automation/cron
 * Vercel crons invoke GET — delegate to POST so cadences and scheduler jobs run.
 */
export async function GET(request: NextRequest) {
  return POST(request);
}
