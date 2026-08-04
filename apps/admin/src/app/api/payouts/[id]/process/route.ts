import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { FINANCIAL_TENANT_ROLES, requireAdminRole } from '@/lib/auth';

/**
 * POST /api/payouts/[id]/process — dispatch an approved commission payout.
 *
 * This route previously checked only that `getActiveTenant()` returned
 * something, then forwarded the caller-supplied id straight to the
 * `payouts-process` edge function, which runs with the service-role key. Any
 * authenticated user of any tenant — including `read_only` — could therefore
 * trigger a real Stripe/ACH transfer against another tenant's payout.
 *
 * Two gates now, matching the edge function's own:
 *   1. Admin-tier role in the ACTIVE tenant, restricted to financial roles.
 *   2. The payout must belong to that tenant — verified with the caller's own
 *      cookie-scoped client, so RLS applies, before any escalation.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { profile, error: authError } = await requireAdminRole(
    supabase,
    FINANCIAL_TENANT_ROLES,
  );
  if (authError) return authError;

  // Ownership check on the session client (RLS applies). Without this the id is
  // an unvalidated IDOR straight into a service-role money movement.
  const { data: payout } = await supabase
    .from('commission_payouts')
    .select('id')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .maybeSingle();

  if (!payout) {
    return NextResponse.json({ error: 'payout_not_found' }, { status: 404 });
  }

  const { data, error } = await supabase.functions.invoke('payouts-process', {
    body: { payout_id: id },
  });

  if (error) {
    return NextResponse.json({ error: 'process_failed', message: error.message }, { status: 500 });
  }

  if (data?.status === 'failed') {
    return NextResponse.redirect(new URL(`/commissions/payouts/${id}?error=${encodeURIComponent(data.message ?? 'failed')}`, request.url));
  }

  return NextResponse.redirect(new URL(`/commissions/payouts/${id}`, request.url));
}
