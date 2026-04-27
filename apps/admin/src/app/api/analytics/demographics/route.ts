import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getActiveTenant } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();

    const tenant = await getActiveTenant();
    if (!profile || !['owner', 'admin', 'staff'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await (supabase as any).rpc('get_group_demographics', {
      p_org_id: tenant.organizationId,
    });

    if (error) {
      console.error('Demographics RPC error:', error);
      return NextResponse.json({ error: 'Failed to load demographics' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Demographics API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
