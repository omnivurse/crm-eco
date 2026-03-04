import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/crm/developer/webhooks/deliveries?webhook_id=<uuid>&status=failed
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden — admin/manager only' }, { status: 403 });
    }

    const webhookId = request.nextUrl.searchParams.get('webhook_id');
    const status = request.nextUrl.searchParams.get('status');
    const eventType = request.nextUrl.searchParams.get('event_type');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50', 10);
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0', 10);

    let query = supabase
      .from('crm_webhook_deliveries')
      .select('*', { count: 'exact' })
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (webhookId) query = query.eq('webhook_id', webhookId);
    if (status) query = query.eq('status', status);
    if (eventType) query = query.eq('event_type', eventType);

    const { data, error, count } = await query;
    if (error) {
      console.error('[WebhookDeliveries] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch deliveries' }, { status: 500 });
    }

    return NextResponse.json({ deliveries: data || [], total: count || 0 });
  } catch (error) {
    console.error('[WebhookDeliveries] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
