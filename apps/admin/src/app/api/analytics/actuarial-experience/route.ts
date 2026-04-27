import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getActiveTenant } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const tenant = await getActiveTenant();
    if (!profile || !['owner', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const months = parseInt(request.nextUrl.searchParams.get('months') || '24', 10);

    const { data, error } = await (supabase as any).rpc('get_actuarial_experience', {
      p_org_id: tenant.organizationId,
      p_months: Math.min(Math.max(months, 1), 60),
    });

    if (error) {
      console.error('Actuarial RPC error:', error);
      return NextResponse.json({ error: 'Failed to load actuarial data' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Actuarial API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
