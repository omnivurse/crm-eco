import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
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

    if (!profile || !['owner', 'admin', 'staff'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await (supabase as any).rpc('get_group_demographics', {
      p_org_id: profile.organization_id,
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
