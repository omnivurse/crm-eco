import { NextResponse } from 'next/server';
import { requireCrmApiKey } from '@/lib/public-api-auth';
import { emitMembershipWebhook } from '@/lib/membership-webhooks';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireCrmApiKey(request, 'read');
  if ('error' in auth) return auth.error;

  const url = new URL(request.url);
  const sponsorId = url.searchParams.get('sponsor_id');
  const memberId = url.searchParams.get('member_id');
  let query = auth.supabase
    .from('invoices')
    .select('id, invoice_number, status, total, amount_paid, payer_type, sponsor_id, member_id, period_start, period_end')
    .eq('organization_id', auth.key.organization_id)
    .order('created_at', { ascending: false })
    .limit(50);
  if (sponsorId) query = query.eq('sponsor_id', sponsorId);
  if (memberId) query = query.eq('member_id', memberId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoices: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireCrmApiKey(request, 'write');
  if ('error' in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as { invoice_id?: string; event?: string } | null;
  if (body?.event === 'invoice.paid' && body.invoice_id) {
    const { data: invoice } = await auth.supabase
      .from('invoices')
      .select('id, status, organization_id')
      .eq('id', body.invoice_id)
      .eq('organization_id', auth.key.organization_id)
      .maybeSingle();
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    const webhook = await emitMembershipWebhook(
      auth.supabase,
      auth.key.organization_id,
      'invoice.paid',
      { invoice_id: invoice.id, status: invoice.status },
    );
    return NextResponse.json({ invoice, webhook });
  }

  return NextResponse.json({ error: 'Unsupported invoice write' }, { status: 400 });
}
