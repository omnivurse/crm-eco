import { NextRequest, NextResponse } from 'next/server';
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
    // Verify cron secret for security
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');
    
    // Allow if no secret configured (dev mode) or if secret matches
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
 * Health check for the cron endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'message-queue-processor',
    timestamp: new Date().toISOString(),
  });
}
