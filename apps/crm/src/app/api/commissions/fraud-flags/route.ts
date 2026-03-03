import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/commissions/fraud-flags
 *
 * Returns fraud/anomaly flags for the organization.
 * Admin-only. Supports filtering by status and flag_type.
 *
 * Query params:
 *   status – filter by flag status (open, investigating, resolved, dismissed)
 *   flag_type – filter by flag type
 *   batch_id – filter by batch
 *   limit – page size (default 50, max 200)
 *   offset – pagination offset
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['owner', 'super_admin', 'admin'].includes(profile.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const supabase = await createClient();
    const params = request.nextUrl.searchParams;

    const limit = Math.min(Number(params.get('limit') || '50'), 200);
    const offset = Number(params.get('offset') || '0');

    let query = supabase
      .from('payout_fraud_flags')
      .select('*', { count: 'exact' })
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const status = params.get('status');
    if (status) query = query.eq('status', status);

    const flagType = params.get('flag_type');
    if (flagType) query = query.eq('flag_type', flagType);

    const batchId = params.get('batch_id');
    if (batchId) query = query.eq('batch_id', batchId);

    const { data, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      flags: data || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching fraud flags:', error);
    return NextResponse.json({ error: 'Failed to fetch fraud flags' }, { status: 500 });
  }
}
