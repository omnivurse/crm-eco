import { NextRequest, NextResponse } from 'next/server';
import { getAuthProfile } from '@/lib/supabase-server';
import { getAutomationStats } from '@/lib/automation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/automation/stats
 * Get automation statistics for the current organization
 */
export async function GET() {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!profile.crm_role) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const stats = await getAutomationStats(profile.organization_id);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Get automation stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
