import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { FINANCIAL_TENANT_ROLES, requireAdminRole } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  // Executing a price change rewrites enrollment costs and cascades to billing
  // schedules. This route previously checked only that an active tenant existed,
  // so any authenticated member — including `read_only` — could trigger it.
  const { profile, error: authError } = await requireAdminRole(supabase, FINANCIAL_TENANT_ROLES);
  if (authError) return authError;

  // Ownership check before invoking. apply-price-change re-derives the org from
  // the schedule row itself, but failing here gives a clean 404 instead of a
  // confusing 401 from the edge function.
  const { data: schedule } = await supabase
    .from('price_change_schedules')
    .select('id')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .maybeSingle();

  if (!schedule) {
    return NextResponse.json({ error: 'schedule_not_found' }, { status: 404 });
  }

  const { error } = await supabase.functions.invoke('apply-price-change', {
    body: { organization_id: profile.organization_id, schedule_id: id },
  });

  if (error) {
    return NextResponse.json({ error: 'execute_failed', message: error.message }, { status: 500 });
  }

  return NextResponse.redirect(new URL(`/billing/price-changes/${id}`, request.url));
}
