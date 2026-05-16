import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { processEnrollments } from '@/lib/sequences/enrollment-service';

// POST /api/sequences/process - Process due enrollment steps
// This endpoint should be called by a cron job (e.g., every minute)
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access (timing-safe)
    const authHeader = request.headers.get('authorization') || '';
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret) {
      const expected = `Bearer ${cronSecret}`;
      const a = Buffer.from(authHeader);
      const b = Buffer.from(expected);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const result = await processEnrollments();

    return NextResponse.json({
      success: true,
      processed: result.processed,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error processing enrollments:', error);
    return NextResponse.json(
      { error: 'Failed to process enrollments' },
      { status: 500 }
    );
  }
}

// Vercel crons invoke GET — delegate to POST so enrollment processing
// actually fires. Same pattern as /api/cron/idempotency-gc.
export async function GET(request: NextRequest) {
  return POST(request);
}
