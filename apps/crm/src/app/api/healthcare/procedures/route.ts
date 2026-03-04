import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

/**
 * GET /api/healthcare/procedures?category=<optional>
 * Returns medical procedures catalog for the org.
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const category = searchParams.get('category') || null;

    const supabase = await createClient();

    let query = supabase
      .from('medical_procedures')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .eq('is_active', true)
      .order('sort_order')
      .order('procedure_name');

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Medical procedures lookup error:', error);
      return NextResponse.json({ error: 'Failed to fetch procedures' }, { status: 500 });
    }

    return NextResponse.json({ procedures: data || [] });
  } catch (error) {
    console.error('Error in GET /api/healthcare/procedures:', error);
    return NextResponse.json({ error: 'Failed to fetch procedures' }, { status: 500 });
  }
}

/**
 * POST /api/healthcare/procedures
 * Create a new medical procedure (admin only).
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { procedure_code, procedure_name, category, description, cpt_codes, avg_national_price, search_keywords } = body;

    if (!procedure_code || !procedure_name || !category) {
      return NextResponse.json(
        { error: 'procedure_code, procedure_name, and category are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('medical_procedures')
      .insert({
        organization_id: profile.organization_id,
        procedure_code,
        procedure_name,
        category,
        description: description || null,
        cpt_codes: cpt_codes || [],
        avg_national_price: avg_national_price || null,
        search_keywords: search_keywords || [],
      })
      .select()
      .single();

    if (error) {
      console.error('Create procedure error:', error);
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Procedure code already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ procedure: data }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/healthcare/procedures:', error);
    return NextResponse.json({ error: 'Failed to create procedure' }, { status: 500 });
  }
}
