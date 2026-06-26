import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

/**
 * Invoice line item as posted by the invoice builder
 * (crm/invoices/new/page.tsx).
 */
const lineItemSchema = z.object({
  id: z.string().optional(),
  description: z.string().optional().default(''),
  quantity: z.number().nonnegative().optional().default(0),
  rate: z.number().nonnegative().optional().default(0),
  taxRate: z.number().nonnegative().optional().default(0),
  amount: z.number().optional().default(0),
});

/**
 * Payload shape sent by the invoice builder page. The page uses client-side
 * field names (client_*, tax_total, discount_amount, line_items[]) which we
 * map onto the actual `invoices` / `invoice_line_items` columns.
 */
const createInvoiceSchema = z.object({
  invoice_number: z.string().min(1),
  client_id: z.string().uuid().optional(),
  client_name: z.string().optional(),
  client_email: z.string().optional(),
  issue_date: z.string().optional(),
  due_date: z.string().optional(),
  payment_terms: z.string().optional(),
  currency: z.string().optional().default('USD'),
  line_items: z.array(lineItemSchema).optional().default([]),
  subtotal: z.number().optional().default(0),
  tax_total: z.number().optional().default(0),
  discount_type: z.enum(['percent', 'fixed']).optional(),
  discount_value: z.number().optional().default(0),
  discount_amount: z.number().optional().default(0),
  total: z.number().optional().default(0),
  notes: z.string().optional(),
  terms: z.string().optional(),
  status: z.string().optional().default('draft'),
});

/**
 * POST /api/invoices
 * Create a new invoice (with line items) for the current organization.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();

    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createInvoiceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    const data = parsed.data;

    // The payment-terms tax rate isn't stored per-invoice as a single column;
    // derive an effective rate for display from the subtotal when available.
    const effectiveTaxRate =
      data.subtotal > 0 ? (data.tax_total / data.subtotal) * 100 : null;

    const balanceDue = data.total;

    const { data: invoice, error } = await supabase
      .from('invoices')
      .insert({
        organization_id: profile.organization_id,
        invoice_number: data.invoice_number,
        contact_id: data.client_id || null,
        title: data.client_name || null,
        currency: data.currency || 'USD',
        due_date: data.due_date || null,
        subtotal: data.subtotal,
        tax_rate: effectiveTaxRate,
        tax_amount: data.tax_total,
        discount_type: data.discount_type || null,
        discount_value: data.discount_value,
        total: data.total,
        amount_paid: 0,
        balance_due: balanceDue,
        status: data.status || 'draft',
        notes: data.notes || null,
        terms: data.terms || null,
        created_by: profile.id,
        sent_at: data.status === 'sent' ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (error) {
      console.error('Create invoice error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Persist line items, mapping the builder's field names onto the
    // invoice_line_items columns. Only keep meaningful rows.
    const items = data.line_items.filter(
      (i) => (i.description && i.description.trim().length > 0) || i.rate > 0
    );

    if (items.length > 0) {
      const lineRows = items.map((item, index) => {
        const lineSubtotal = item.quantity * item.rate;
        const lineTotal = lineSubtotal + lineSubtotal * ((item.taxRate || 0) / 100);
        return {
          invoice_id: invoice.id,
          name: item.description || 'Item',
          description: item.description || null,
          quantity: item.quantity,
          unit_price: item.rate,
          total: lineTotal,
          sort_order: index,
        };
      });

      const { error: itemsError } = await supabase
        .from('invoice_line_items')
        .insert(lineRows);

      if (itemsError) {
        console.error('Create invoice line items error:', itemsError);
        // Roll back the invoice so we don't leave an empty shell.
        await supabase.from('invoices').delete().eq('id', invoice.id);
        return NextResponse.json({ error: itemsError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ id: invoice.id, invoice }, { status: 201 });
  } catch (error) {
    console.error('Create invoice error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
