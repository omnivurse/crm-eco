import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

/**
 * Quote line item as posted by the quote builder UI
 * (apps/crm/src/app/crm/quotes/new/page.tsx).
 */
const lineItemSchema = z.object({
  productName: z.string().optional().default(''),
  description: z.string().optional().default(''),
  quantity: z.number().nonnegative().optional().default(1),
  unitPrice: z.number().nonnegative().optional().default(0),
  discount: z.number().nonnegative().optional().default(0),
  discountType: z.enum(['percent', 'fixed']).optional().default('percent'),
  amount: z.number().optional().default(0),
});

const createQuoteSchema = z.object({
  quote_number: z.string().min(1),
  title: z.string().optional(),
  prospect_id: z.string().uuid(),
  prospect_name: z.string().optional(),
  prospect_email: z.string().optional(),
  quote_date: z.string().optional(),
  expiry_date: z.string().optional().nullable(),
  validity_days: z.number().int().positive().optional().nullable(),
  line_items: z.array(lineItemSchema).optional().default([]),
  subtotal: z.number().optional().default(0),
  total_discount: z.number().optional().default(0),
  total: z.number().optional().default(0),
  notes: z.string().optional(),
  terms: z.string().optional(),
  status: z.enum(['draft', 'sent']).optional().default('draft'),
});

/**
 * POST /api/quotes
 * Create a quote (plus its line items) scoped to the caller's organization.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();

    if (!profile || !profile.organization_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createQuoteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    const data = parsed.data;

    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .insert({
        organization_id: profile.organization_id,
        created_by: profile.id,
        quote_number: data.quote_number,
        title: data.title || null,
        contact_id: data.prospect_id,
        status: data.status,
        currency: 'USD',
        subtotal: data.subtotal,
        discount_type: 'fixed',
        discount_value: data.total_discount,
        total: data.total,
        notes: data.notes || null,
        terms: data.terms || null,
        valid_until: data.expiry_date || null,
        sent_at: data.status === 'sent' ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (quoteError) {
      console.error('Create quote error:', quoteError);
      return NextResponse.json({ error: quoteError.message }, { status: 500 });
    }

    // Persist line items (only those with a name or a non-zero price).
    const itemsToInsert = data.line_items
      .filter((item) => item.productName || item.unitPrice > 0)
      .map((item, index) => ({
        quote_id: quote.id,
        name: item.productName || 'Item',
        description: item.description || null,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        discount_type: item.discountType === 'percent' ? 'percentage' : 'fixed',
        discount_value: item.discount,
        total: item.amount,
        sort_order: index,
      }));

    if (itemsToInsert.length > 0) {
      const { error: itemsError } = await supabase
        .from('quote_line_items')
        .insert(itemsToInsert);

      if (itemsError) {
        // Roll back the parent quote so we never leave an orphaned header.
        console.error('Create quote line items error:', itemsError);
        await supabase.from('quotes').delete().eq('id', quote.id);
        return NextResponse.json({ error: itemsError.message }, { status: 500 });
      }
    }

    return NextResponse.json(quote, { status: 201 });
  } catch (error) {
    console.error('Create quote error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
