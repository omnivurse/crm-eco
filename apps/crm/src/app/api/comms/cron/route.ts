import { NextRequest, NextResponse } from 'next/server';
import { processMessageQueue } from '@/lib/comms';
import { verifyCronSecret } from '@/lib/security/verify-cron-secret';

/**
 * POST /api/comms/cron
 * Process the message queue - sends queued messages and retries failed ones
 * 
 * This should be called by a cron job or scheduler
 * Secured via CRON_SECRET header
 */
export async function POST(request: NextRequest) {
  try {
    // Fail closed: a missing CRON_SECRET now rejects instead of allowing
    // everyone through. This route drains the outbound message queue.
    const unauthorized = verifyCronSecret(request);
    if (unauthorized) return unauthorized;

    // Get optional limit from query params
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Process the queue
    const result = await processMessageQueue(Math.min(limit, 100));

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Message queue processing error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/comms/cron
 * Vercel crons invoke GET — delegate to POST so queue processing
 * actually fires. Same pattern as /api/cron/idempotency-gc.
 */
export async function GET(request: NextRequest) {
  return POST(request);
}
