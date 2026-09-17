import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getActiveTenant } from '@/lib/tenant';

const STAFF_ROLES = new Set(['owner', 'super_admin', 'admin', 'staff']);

export async function requireSponsorStaff() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const tenant = await getActiveTenant();
  if (!tenant || !STAFF_ROLES.has(tenant.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { supabase: supabase as any, user, tenant };
}
