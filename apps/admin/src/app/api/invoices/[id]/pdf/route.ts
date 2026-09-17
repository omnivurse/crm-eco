import { NextResponse } from 'next/server';
import { renderInvoiceHtml } from '@crm-eco/lib';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { requireActiveTenant } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

/**
 * Printable invoice. Live invoices have no pdf_url column and no PDF edge
 * function — return HTML the browser can print/save.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await requireActiveTenant();
    const { id: invoiceId } = await params;
    const supabase = await createServerSupabaseClient();
    const html = await renderInvoiceHtml(supabase as any, {
      organizationId: tenant.organizationId,
      invoiceId,
    });
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="invoice-${invoiceId}.html"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
