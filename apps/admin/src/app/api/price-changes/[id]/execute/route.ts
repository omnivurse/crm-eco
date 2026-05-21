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

  const { error } = await supabase.functions.invoke('apply-price-change', {
    body: { organization_id: tenant.organizationId, schedule_id: id },
  });

  if (error) {
    return NextResponse.json({ error: 'execute_failed', message: error.message }, { status: 500 });
  }

  return NextResponse.redirect(new URL(`/billing/price-changes/${id}`, request.url));
}
