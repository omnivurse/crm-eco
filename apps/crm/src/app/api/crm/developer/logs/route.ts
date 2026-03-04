import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/crm/developer/logs?api_key_id=<uuid>&method=POST&status_gte=400
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    const apiKeyId = request.nextUrl.searchParams.get('api_key_id');
    const method = request.nextUrl.searchParams.get('method');
    const path = request.nextUrl.searchParams.get('path');
    const statusGte = request.nextUrl.searchParams.get('status_gte');
    const statusLte = request.nextUrl.searchParams.get('status_lte');
    const rateLimited = request.nextUrl.searchParams.get('rate_limited');
    const fromDate = request.nextUrl.searchParams.get('from_date');
    const toDate = request.nextUrl.searchParams.get('to_date');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50', 10);
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0', 10);

    let query = supabase
      .from('crm_api_logs')
      .select('*', { count: 'exact' })
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (apiKeyId) query = query.eq('api_key_id', apiKeyId);
    if (method) query = query.eq('method', method.toUpperCase());
    if (path) query = query.ilike('path', `%${path}%`);
    if (statusGte) query = query.gte('response_status', parseInt(statusGte, 10));
    if (statusLte) query = query.lte('response_status', parseInt(statusLte, 10));
    if (rateLimited === 'true') query = query.eq('rate_limited', true);
    if (fromDate) query = query.gte('created_at', fromDate);
    if (toDate) query = query.lte('created_at', toDate);

    const { data, error, count } = await query;
    if (error) {
      console.error('[ApiLogs] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch API logs' }, { status: 500 });
    }

    return NextResponse.json({ logs: data || [], total: count || 0 });
  } catch (error) {
    console.error('[ApiLogs] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
