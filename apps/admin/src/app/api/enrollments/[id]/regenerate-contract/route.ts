import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getActiveTenant } from '@/lib/tenant';

/**
 * POST /api/enrollments/[id]/regenerate-contract
 * Triggers regeneration of the enrollment contract PDF via the
 * Supabase `generate-enrollment-contract` Edge Function.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const tenant = await getActiveTenant();

  if (!tenant) {
    return NextResponse.redirect(new URL('/login', _request.url));
  }

  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id')
    .eq('id', id)
    .eq('organization_id', tenant.organizationId)
    .single();

  if (!enrollment) {
    return NextResponse.json({ error: 'enrollment_not_found' }, { status: 404 });
  }

  const { error } = await supabase.functions.invoke('generate-enrollment-contract', {
    body: { enrollment_id: id },
  });

  if (error) {
    return NextResponse.json(
      { error: 'regeneration_failed', message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.redirect(new URL(`/enrollments/${id}/agreements`, _request.url));
}
