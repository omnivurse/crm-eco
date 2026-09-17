import { NextResponse } from 'next/server';
import { findOrCreatePublicMember } from '@crm-eco/lib';
import { requireCrmApiKey } from '@/lib/public-api-auth';
import { emitMembershipWebhook } from '@/lib/membership-webhooks';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireCrmApiKey(request, 'read');
  if ('error' in auth) return auth.error;

  const url = new URL(request.url);
  const email = url.searchParams.get('email');
  let query = auth.supabase
    .from('members')
    .select('id, first_name, last_name, email, date_of_birth, status')
    .eq('organization_id', auth.key.organization_id)
    .is('merged_into_id', null)
    .order('created_at', { ascending: false })
    .limit(50);
  if (email) query = query.eq('email', email.toLowerCase());

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ members: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireCrmApiKey(request, 'write');
  if ('error' in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as {
    first_name?: string;
    last_name?: string;
    email?: string;
    date_of_birth?: string;
    phone?: string;
  } | null;
  if (!body?.first_name || !body.last_name || !body.email) {
    return NextResponse.json({ error: 'first_name, last_name, and email are required' }, { status: 400 });
  }

  const created = await findOrCreatePublicMember(auth.supabase, {
    organizationId: auth.key.organization_id,
    member: {
      first_name: body.first_name,
      last_name: body.last_name,
      email: body.email,
      date_of_birth: body.date_of_birth,
      phone: body.phone,
    },
    coverageStart: new Date().toISOString().slice(0, 10),
    source: 'public_api',
  });
  if ('error' in created) {
    return NextResponse.json({ error: created.error, message: created.message }, { status: created.status });
  }

  if (created.created) {
    await emitMembershipWebhook(auth.supabase, auth.key.organization_id, 'member.created', {
      member_id: created.memberId,
    });
  }
  return NextResponse.json({ member_id: created.memberId, created: created.created }, { status: created.created ? 201 : 200 });
}
