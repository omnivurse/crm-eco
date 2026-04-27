import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getActiveTenant } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { searchParams } = request.nextUrl;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve the active tenant. This already verifies membership
    // and respects the user's current org switcher selection.
    const tenant = await getActiveTenant();
    if (!tenant) {
      return NextResponse.json(
        { error: 'No active tenant in scope' },
        { status: 403 },
      );
    }

    if (!['owner', 'super_admin', 'admin'].includes(tenant.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let query = supabase
      .from('unified_audit_logs')
      .select('*')
      .eq('organization_id', tenant.organizationId)
      .order('created_at', { ascending: false });

    const userId = searchParams.get('userId');
    const action = searchParams.get('action');
    const riskLevel = searchParams.get('riskLevel');
    const appSource = searchParams.get('appSource');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const searchQuery = searchParams.get('q');

    if (userId) {
      query = query.eq('actor_id', userId);
    }

    if (action) {
      query = query.eq('action', action);
    }

    if (riskLevel) {
      query = query.eq('risk_level', riskLevel);
    }

    if (appSource) {
      query = query.eq('app_source', appSource);
    }

    if (from) {
      query = query.gte('created_at', from);
    }

    if (to) {
      query = query.lte('created_at', to);
    }

    if (searchQuery) {
      // Sanitize input to prevent PostgREST filter injection.
      const safeQuery = searchQuery.replace(/[,().\\]/g, '\\$&');
      query = query.or(
        `description.ilike.%${safeQuery}%,action.ilike.%${safeQuery}%,actor_email.ilike.%${safeQuery}%`,
      );
    }

    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');
    query = query.range(offset, offset + limit - 1);

    const { data: logs, error } = await query;

    if (error) {
      console.error('[Admin AuditLogs API] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
    }

    return NextResponse.json({ logs });
  } catch (error) {
    console.error('[Admin AuditLogs API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
