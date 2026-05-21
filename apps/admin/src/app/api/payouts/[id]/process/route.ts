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
