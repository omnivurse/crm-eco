import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { getAutomationRuns } from '@/lib/automation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/automation/runs
 * List automation runs with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!profile.crm_role) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const source = searchParams.get('source') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const runs = await getAutomationRuns(profile.organization_id, {
      status: status !== 'all' ? status : undefined,
      source: source !== 'all' ? source : undefined,
      limit,
      offset,
    });

    return NextResponse.json(runs);
  } catch (error) {
    console.error('Get automation runs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
