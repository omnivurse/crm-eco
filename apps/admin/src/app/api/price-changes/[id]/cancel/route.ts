import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getActiveTenant } from '@/lib/tenant';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const tenant = await getActiveTenant();
  if (!tenant) return NextResponse.redirect(new URL('/login', request.url));

  const { error } = await supabase
    .from('price_change_schedules')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', tenant.organizationId)
    .eq('status', 'pending');

  if (error) {
    return NextResponse.json({ error: 'cancel_failed', message: error.message }, { status: 500 });
  }

  return NextResponse.redirect(new URL('/billing/price-changes', request.url));
}
