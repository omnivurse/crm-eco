import { NextResponse } from 'next/server';
import { renderInvoiceHtml } from '@crm-eco/lib';
import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { requireEmployerSponsors } from '@/lib/employer';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sponsorId: string; invoiceId: string }> },
) {
  const ctx = await requireEmployerSponsors();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { sponsorId, invoiceId } = await params;
  const sponsor = ctx.sponsors.find((s) => s.id === sponsorId);
  if (!sponsor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = createServiceRoleClient() as any;
  const { data: invoice } = await supabase
    .from('invoices')
    .select('id')
    .eq('id', invoiceId)
    .eq('sponsor_id', sponsorId)
    .eq('payer_type', 'sponsor')
    .maybeSingle();
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

  const html = await renderInvoiceHtml(supabase, {
    organizationId: sponsor.organization_id,
    invoiceId,
  });
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="invoice-${invoiceId}.html"`,
    },
  });
}
