import { NextResponse } from 'next/server';
import { requireCrmApiKey } from '@/lib/public-api-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await requireCrmApiKey(request, 'write');
  if ('error' in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as {
    member_id?: string;
    authorize_customer_profile_id?: string;
    authorize_payment_profile_id?: string;
    last_four?: string;
    payment_type?: string;
  } | null;
  if (
    !body?.member_id ||
    !body.authorize_customer_profile_id ||
    !body.authorize_payment_profile_id ||
    !body.last_four
  ) {
    return NextResponse.json(
      { error: 'member_id, Authorize.Net profile ids, and last_four are required' },
      { status: 400 },
    );
  }

  const { data: member } = await auth.supabase
    .from('members')
    .select('id')
    .eq('id', body.member_id)
    .eq('organization_id', auth.key.organization_id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

  const { data, error } = await auth.supabase
    .from('payment_profiles')
    .insert({
      organization_id: auth.key.organization_id,
      member_id: body.member_id,
      authorize_customer_profile_id: body.authorize_customer_profile_id,
      authorize_payment_profile_id: body.authorize_payment_profile_id,
      last_four: body.last_four,
      payment_type: body.payment_type || 'credit_card',
      is_default: true,
      is_active: true,
    })
    .select('id, member_id, last_four, payment_type')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ payment_method: data }, { status: 201 });
}
