import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/commissions/audit
 *
 * Returns the immutable payout audit log.
 * Admin-only. Supports filtering by event_type, entity_type, entity_id.
 *
 * Query params:
 *   event_type – filter by event type
 *   entity_type – filter by entity type
 *   entity_id – filter by entity ID
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
      .from('payout_audit_log')
      .select('id, event_type, entity_type, entity_id, actor_id, actor_type, prev_status, new_status, amount, details, created_at', { count: 'exact' })
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const eventType = params.get('event_type');
    if (eventType) query = query.eq('event_type', eventType);

    const entityType = params.get('entity_type');
    if (entityType) query = query.eq('entity_type', entityType);

    const entityId = params.get('entity_id');
    if (entityId) query = query.eq('entity_id', entityId);

    const { data, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      entries: data || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    return NextResponse.json({ error: 'Failed to fetch audit log' }, { status: 500 });
  }
}
