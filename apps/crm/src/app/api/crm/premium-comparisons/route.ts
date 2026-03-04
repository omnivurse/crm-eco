import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * GET /api/crm/premium-comparisons
 * List comparisons (optionally filtered by record_id)
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const recordId = searchParams.get('record_id');

    let query = supabase
      .from('comparison_summary')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false });

    if (recordId) {
      query = query.eq('record_id', recordId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Comparisons GET]', error);
      return NextResponse.json({ error: 'Failed to fetch comparisons' }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('[Comparisons GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const createComparisonSchema = z.object({
  comparison_name: z.string().min(1).max(255),
  record_id: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
  items: z.array(z.object({
    label: z.string().min(1).max(255),
    plan_type: z.enum(['insurance', 'healthshare', 'medicaid', 'short_term']),
    plan_id: z.string().uuid().optional(),
    full_premium: z.number().min(0),
    tax_credit: z.number().min(0).default(0),
    deductible: z.number().min(0).optional(),
    max_oop: z.number().min(0).optional(),
    metal_level: z.string().optional(),
    display_order: z.number().int().min(0).optional(),
  })).min(1).max(10),
});

/**
 * POST /api/crm/premium-comparisons
 * Create a comparison with items in one call
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['crm_admin', 'crm_manager', 'crm_agent'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createComparisonSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    const supabase = await createClient();

    // Create comparison
    const { data: comparison, error: compError } = await supabase
      .from('premium_comparisons')
      .insert({
        organization_id: profile.organization_id,
        comparison_name: parsed.data.comparison_name,
        record_id: parsed.data.record_id,
        notes: parsed.data.notes,
        created_by: profile.id,
      })
      .select()
      .single();

    if (compError || !comparison) {
      console.error('[Comparisons POST]', compError);
      return NextResponse.json({ error: 'Failed to create comparison' }, { status: 500 });
    }

    // Create items
    const itemRows = parsed.data.items.map((item, idx) => ({
      comparison_id: comparison.id,
      label: item.label,
      plan_type: item.plan_type,
      plan_id: item.plan_id,
      full_premium: item.full_premium,
      tax_credit: item.tax_credit,
      deductible: item.deductible,
      max_oop: item.max_oop,
      metal_level: item.metal_level,
      display_order: item.display_order ?? idx,
    }));

    const { data: items, error: itemsError } = await supabase
      .from('premium_comparison_items')
      .insert(itemRows)
      .select();

    if (itemsError) {
      console.error('[Comparisons POST items]', itemsError);
    }

    return NextResponse.json({
      data: { ...comparison, items: items || [] },
    }, { status: 201 });
  } catch (error) {
    console.error('[Comparisons POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
