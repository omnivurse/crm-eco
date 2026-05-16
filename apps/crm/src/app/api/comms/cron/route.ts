import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { processMessageQueue } from '@/lib/comms';

/**
 * POST /api/comms/cron
 * Process the message queue - sends queued messages and retries failed ones
 * 
 * This should be called by a cron job or scheduler
 * Secured via CRON_SECRET header
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret for security (timing-safe)
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization') || '';

    // Allow if no secret configured (dev mode) or if secret matches
    if (cronSecret) {
      const expected = `Bearer ${cronSecret}`;
      const a = Buffer.from(authHeader);
      const b = Buffer.from(expected);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

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
