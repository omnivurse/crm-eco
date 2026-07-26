import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getActiveTenant } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

/** GET /api/inbox — list inbox conversations for admin */
export async function GET(request: NextRequest) {
  try {
    const tenant = await getActiveTenant();
    if (!tenant || !['owner', 'admin', 'staff'].includes(tenant.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'active';
    const limit = Math.min(Number(searchParams.get('limit') || 50), 100);

    const supabase = await createServerSupabaseClient();

    let query = (supabase as any)
      .from('inbox_conversations')
      .select('*')
      .eq('org_id', tenant.organizationId)
      .order('last_message_at', { ascending: false })
      .limit(limit);

    if (status === 'active') {
      query = query.in('status', ['open', 'pending']);
    } else if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Admin inbox list error:', error);
      return NextResponse.json({ error: 'Failed to load inbox' }, { status: 500 });
    }

    return NextResponse.json({ conversations: data || [] });
  } catch (error) {
    console.error('Admin inbox GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
