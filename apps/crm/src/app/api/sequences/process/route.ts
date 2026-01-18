import { NextRequest, NextResponse } from 'next/server';
import { processEnrollments } from '@/lib/sequences/enrollment-service';

// POST /api/sequences/process - Process due enrollment steps
// This endpoint should be called by a cron job (e.g., every minute)
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

// GET for health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'sequence-processor',
    timestamp: new Date().toISOString(),
  });
}
