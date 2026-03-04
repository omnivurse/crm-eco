import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

/**
 * GET /api/healthcare/networks/:id/plans
 * List insurance plans linked to a network.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('network_plan_links')
      .select(`
        *,
        insurance_plans(
          id, plan_name, plan_type, metal_level, base_premium,
          deductible, max_out_of_pocket, is_active,
          insurance_carriers(id, carrier_name)
        )
      `)
      .eq('network_id', id)
      .order('is_primary', { ascending: false });

    if (error) {
      console.error('Network plans list error:', error);
      return NextResponse.json({ error: 'Failed to list plans' }, { status: 500 });
    }

    return NextResponse.json({ plans: data || [] });
  } catch (error) {
    console.error('Error in GET /api/healthcare/networks/[id]/plans:', error);
    return NextResponse.json({ error: 'Failed to list plans' }, { status: 500 });
  }
}

/**
 * POST /api/healthcare/networks/:id/plans
 * Link an insurance plan to a network.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { plan_id, is_primary } = body;

    if (!plan_id) {
      return NextResponse.json({ error: 'plan_id is required' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('network_plan_links')
      .insert({
        network_id: id,
        plan_id,
        is_primary: is_primary ?? true,
      })
      .select('*, insurance_plans(id, plan_name, insurance_carriers(carrier_name))')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'This plan is already linked to the network' },
          { status: 409 }
        );
      }
      console.error('Link plan error:', error);
      return NextResponse.json({ error: 'Failed to link plan' }, { status: 500 });
    }

    return NextResponse.json({ link: data }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/healthcare/networks/[id]/plans:', error);
    return NextResponse.json({ error: 'Failed to link plan' }, { status: 500 });
  }
}
