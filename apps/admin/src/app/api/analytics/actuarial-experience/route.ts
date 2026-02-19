import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .single() as { data: { organization_id: string; role: string } | null };

    if (!profile || !['owner', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const months = parseInt(request.nextUrl.searchParams.get('months') || '24', 10);

    const { data, error } = await (supabase as any).rpc('get_actuarial_experience', {
      p_org_id: profile.organization_id,
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
