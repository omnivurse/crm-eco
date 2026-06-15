import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { requireActiveTenant } from '@/lib/tenant';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Invoice PDF Generator
 *
 * GET /api/invoices/[id]/pdf
 *
 * Generates an invoice PDF using the Supabase Edge Function
 * or returns the cached PDF URL if already generated.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await requireActiveTenant();
    const { id: invoiceId } = await params;

    if (!invoiceId) {
      return NextResponse.json({ error: 'Invoice ID required' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();

    // Tenant-scoped read — never fetch by id alone with service role.
    const { data: invoice, error } = await (supabase as any)
      .from('invoices')
      .select(`
        *,
        members (
          id, first_name, last_name, email,
          address_line1, address_line2, city, state, postal_code
        ),
        organizations (
          id, name, slug, branding
        )
      `)
      .eq('id', invoiceId)
      .eq('organization_id', tenant.organizationId)
      .single();

    if (error || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // If PDF already exists, redirect to it
    if (invoice.pdf_url) {
      return NextResponse.json({
        success: true,
        pdf_url: invoice.pdf_url,
        cached: true,
      });
    }

    // Edge function needs service role; invoice ownership already verified above.
    const serviceClient = createServiceRoleClient();
    const { data: result, error: fnError } = await serviceClient.functions.invoke(
      'generate-invoice-pdf',
      {
        body: { invoice_id: invoiceId },
      }
    );

    if (fnError) {
      console.error('[INVOICE PDF] Edge function error:', fnError);
      return NextResponse.json(
        { error: 'Failed to generate invoice PDF' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      pdf_url: result?.pdf_url,
      cached: false,
    });
  } catch (error) {
    console.error('[INVOICE PDF] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
