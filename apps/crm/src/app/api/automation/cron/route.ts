import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { processPendingCadenceSteps } from '@/lib/automation';

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
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // 2. Process SLA escalations (future implementation)
    // results.sla = await processSlaEscalations();

    // 3. Process scheduled workflows (future implementation)
    // results.scheduled = await processScheduledWorkflows();

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
 * Health check for cron endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/automation/cron',
    description: 'Scheduled automation processing endpoint',
  });
}
