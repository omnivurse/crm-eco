import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { timingSafeEqual } from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * POST /api/analytics/refresh
 *
 * Refreshes materialized views and advisor commission summaries.
 * Secured by either CRON_SECRET header (for automated jobs) or admin role.
 */
export async function POST(request: NextRequest) {
  try {
    // Check for cron secret first (automated refresh)
    const cronSecret = request.headers.get('x-cron-secret') || request.headers.get('authorization')?.replace('Bearer ', '');
    const expectedSecret = process.env.CRON_SECRET;

    let authorized = false;

    if (cronSecret && expectedSecret) {
      try {
        const a = Buffer.from(cronSecret);
        const b = Buffer.from(expectedSecret);
        authorized = a.length === b.length && timingSafeEqual(a, b);
      } catch {
        authorized = false;
      }
    }

    // Fallback: check admin auth
    if (!authorized) {
      const profile = await getAuthProfile();
      if (!profile) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (!['owner', 'super_admin', 'admin'].includes(profile.role || '')) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
      authorized = true;
    }

    const supabase = await createClient();

    // 1. Refresh materialized views
    const { data: mvResult, error: mvError } = await supabase.rpc('refresh_reporting_views');

    // 2. Refresh advisor commission summaries for current month
    const { data: summaryCount, error: summaryError } = await supabase.rpc('refresh_advisor_commission_summary');

    const result = {
      materialized_views: mvError ? { error: mvError.message } : mvResult,
      commission_summaries: summaryError ? { error: summaryError.message } : { rows_upserted: summaryCount },
      refreshed_at: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Analytics refresh error:', error);
    return NextResponse.json({ error: 'Failed to refresh analytics' }, { status: 500 });
  }
}

/**
 * GET /api/analytics/refresh — Health check
 */
export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'analytics-refresh' });
}
