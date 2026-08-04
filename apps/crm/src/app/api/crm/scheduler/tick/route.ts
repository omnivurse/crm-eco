import { NextRequest, NextResponse } from 'next/server';
import { processScheduledJobs, processScheduledWorkflows } from '@/lib/automation';
import { verifyCronSecret } from '@/lib/security/verify-cron-secret';

/**
 * POST /api/crm/scheduler/tick
 * 
 * Process pending scheduler jobs and scheduled workflows.
 * Should be called periodically by an external cron job.
 * 
 * Secured by CRON_SECRET environment variable.
 */
export async function POST(request: NextRequest) {
  try {
    // Fail closed: a missing CRON_SECRET now rejects instead of allowing
    // everyone through. This route runs scheduled jobs and workflows under the
    // service role.
    const unauthorized = verifyCronSecret(request);
    if (unauthorized) return unauthorized;

    // Parse optional parameters from body
    let limit = 100;
    let jobTypes: string[] | undefined;

    try {
      const body = await request.json();
      if (body.limit) limit = Math.min(body.limit, 500);
      if (body.jobTypes) jobTypes = body.jobTypes;
    } catch {
      // Body is optional
    }

    const results: Record<string, unknown> = {};

    // 1. Process pending scheduler jobs
    try {
      const jobResults = await processScheduledJobs(limit, jobTypes as Parameters<typeof processScheduledJobs>[1]);
      results.schedulerJobs = {
        processed: jobResults.processed,
        completed: jobResults.completed,
        failed: jobResults.failed,
        retrying: jobResults.retrying,
      };
    } catch (error) {
      results.schedulerJobs = {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // 2. Process scheduled workflows (cron-like)
    try {
      const workflowResults = await processScheduledWorkflows();
      results.scheduledWorkflows = workflowResults;
    } catch (error) {
      results.scheduledWorkflows = {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error) {
    console.error('Scheduler tick error:', error);
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
 * GET /api/crm/scheduler/tick
 * Health check for scheduler endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/crm/scheduler/tick',
    description: 'Scheduler tick endpoint for processing pending jobs',
    usage: {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer <CRON_SECRET>',
      },
      body: {
        limit: 'number (optional, default 100, max 500)',
        jobTypes: 'string[] (optional) - Filter by job types',
      },
    },
  });
}
