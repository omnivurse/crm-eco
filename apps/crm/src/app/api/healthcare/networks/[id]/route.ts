import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

/**
 * GET /api/healthcare/networks/:id
 * Network detail with provider count, plan count, and top coverage ZIPs.
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

    const { data: network, error } = await supabase
      .from('provider_networks')
      .select('*, insurance_carriers(id, carrier_name, carrier_type)')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (error || !network) {
      return NextResponse.json({ error: 'Network not found' }, { status: 404 });
    }

    // Get provider count by tier
    const { data: providerStats } = await supabase
      .from('network_providers')
      .select('network_tier')
      .eq('network_id', id)
      .eq('is_active', true);

    const tierCounts = { in_network_preferred: 0, in_network: 0, out_of_network: 0 };
    for (const p of providerStats || []) {
      if (p.network_tier in tierCounts) {
        tierCounts[p.network_tier as keyof typeof tierCounts]++;
      }
    }

    // Get linked plan count
    const { count: planCount } = await supabase
      .from('network_plan_links')
      .select('id', { count: 'exact', head: true })
      .eq('network_id', id);

    // Get top coverage ZIPs
    const { data: topZips } = await supabase
      .from('network_coverage_zips')
      .select('zip_code, state, provider_count, coverage_score')
      .eq('network_id', id)
      .order('coverage_score', { ascending: false })
      .limit(10);

    return NextResponse.json({
      network,
      stats: {
        total_providers: (providerStats || []).length,
        tier_breakdown: tierCounts,
        linked_plans: planCount || 0,
      },
      top_coverage_zips: topZips || [],
    });
  } catch (error) {
    console.error('Error in GET /api/healthcare/networks/[id]:', error);
    return NextResponse.json({ error: 'Failed to get network' }, { status: 500 });
  }
}

/**
 * PATCH /api/healthcare/networks/:id
 * Update a provider network.
 */
export async function PATCH(
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

    const allowedFields = [
      'network_name', 'network_type', 'carrier_id', 'description',
      'coverage_states', 'effective_date', 'end_date', 'is_active', 'metadata',
    ];
    const updates: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in body) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('provider_networks')
      .update(updates)
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .select('*, insurance_carriers(id, carrier_name)')
      .single();

    if (error) {
      console.error('Network update error:', error);
      return NextResponse.json({ error: 'Failed to update network' }, { status: 500 });
    }

    return NextResponse.json({ network: data });
  } catch (error) {
    console.error('Error in PATCH /api/healthcare/networks/[id]:', error);
    return NextResponse.json({ error: 'Failed to update network' }, { status: 500 });
  }
}

/**
 * DELETE /api/healthcare/networks/:id
 * Delete a provider network (admin only via RLS).
 */
export async function DELETE(
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

    const { error } = await supabase
      .from('provider_networks')
      .delete()
      .eq('id', id)
      .eq('organization_id', profile.organization_id);

    if (error) {
      console.error('Network delete error:', error);
      return NextResponse.json({ error: 'Failed to delete network' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/healthcare/networks/[id]:', error);
    return NextResponse.json({ error: 'Failed to delete network' }, { status: 500 });
  }
}
