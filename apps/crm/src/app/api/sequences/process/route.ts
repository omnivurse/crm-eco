import { NextRequest, NextResponse } from 'next/server';
import { processEnrollments } from '@/lib/sequences/enrollment-service';
import { verifyCronSecret } from '@/lib/security/verify-cron-secret';

// POST /api/sequences/process - Process due enrollment steps
// This endpoint should be called by a cron job (e.g., every minute)
export async function POST(request: NextRequest) {
  try {
    // Fail closed: a missing CRON_SECRET now rejects instead of allowing
    // everyone through. This route processes sequence enrollments under the
    // service role.
    const unauthorized = verifyCronSecret(request);
    if (unauthorized) return unauthorized;

    const result = await processEnrollments();

    return NextResponse.json({
      success: true,
      processed: result.processed,
      errors: result.errors,
      // Non-zero means the sequence-send flag is closed for those orgs; the
      // enrollments stay due and resume when it is opened.
      skipped: result.skipped,
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
