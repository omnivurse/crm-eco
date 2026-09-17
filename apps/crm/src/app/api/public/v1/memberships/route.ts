import { NextResponse } from 'next/server';
import { requireCrmApiKey } from '@/lib/public-api-auth';
import { emitMembershipWebhook } from '@/lib/membership-webhooks';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireCrmApiKey(request, 'read');
  if ('error' in auth) return auth.error;

  const url = new URL(request.url);
  const memberId = url.searchParams.get('member_id');
  let query = auth.supabase
    .from('memberships')
    .select('id, member_id, plan_id, status, layer, sponsor_id, billing_amount, effective_date, end_date')
    .eq('organization_id', auth.key.organization_id)
    .order('created_at', { ascending: false })
    .limit(50);
  if (memberId) query = query.eq('member_id', memberId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ memberships: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireCrmApiKey(request, 'write');
  if ('error' in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as {
    member_id?: string;
    plan_id?: string;
    layer?: 'core' | 'addon';
    effective_date?: string;
    billing_amount?: number;
  } | null;
  if (!body?.member_id || !body.plan_id) {
    return NextResponse.json({ error: 'member_id and plan_id are required' }, { status: 400 });
  }

  const activate = process.env.PUBLIC_API_MEMBERSHIP_ACTIVATE === 'true';
  const { data, error } = await auth.supabase
    .from('memberships')
    .insert({
      organization_id: auth.key.organization_id,
      member_id: body.member_id,
      plan_id: body.plan_id,
      layer: body.layer === 'addon' ? 'addon' : 'core',
      status: activate ? 'active' : 'pending',
      effective_date: body.effective_date || new Date().toISOString().slice(0, 10),
      billing_amount: body.billing_amount ?? 0,
    })
    .select('id, member_id, plan_id, status, layer, effective_date')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const webhook = await emitMembershipWebhook(
    auth.supabase,
    auth.key.organization_id,
    'membership.updated',
    { membership: data },
  );
  return NextResponse.json({ membership: data, webhook }, { status: 201 });
}
