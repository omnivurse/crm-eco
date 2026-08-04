import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { FINANCIAL_TENANT_ROLES, requireAdminRole } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  // Cancelling a scheduled price change is a financial decision. This route
  // previously checked only that an active tenant existed, so any authenticated
  // member — including `read_only` — could cancel one.
  const { profile, error: authError } = await requireAdminRole(supabase, FINANCIAL_TENANT_ROLES);
  if (authError) return authError;

  const { error } = await supabase
    .from('price_change_schedules')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .eq('status', 'pending');

  if (error) {
    return NextResponse.json({ error: 'cancel_failed', message: error.message }, { status: 500 });
  }

  return NextResponse.redirect(new URL('/billing/price-changes', request.url));
}
