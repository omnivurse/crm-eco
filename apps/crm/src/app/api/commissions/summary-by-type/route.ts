import { NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

// GET /api/commissions/summary-by-type
export async function GET() {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // Try to use the RPC function from the dual-capacity migration
    const { data, error } = await supabase.rpc('get_commission_summary_by_product_type', {
      p_advisor_id: profile.id, // Will be ignored for admins via the RPC logic
      p_org_id: profile.organization_id,
    });

    if (error) {
      // Fallback: query directly with a group by
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('commissions')
        .select('product_type, commission_amount')
        .eq('organization_id', profile.organization_id);

      if (fallbackError) throw fallbackError;

      // Aggregate manually
      const grouped = new Map<string, { total: number; count: number }>();
      for (const row of fallbackData || []) {
        const pt = row.product_type || 'unclassified';
        const existing = grouped.get(pt) || { total: 0, count: 0 };
        existing.total += Number(row.commission_amount) || 0;
        existing.count += 1;
        grouped.set(pt, existing);
      }

      const summary = Array.from(grouped.entries()).map(([pt, stats]) => ({
        product_type: pt,
        total_commissions: stats.total,
        commission_count: stats.count,
      }));

      return NextResponse.json({ summary });
    }

    return NextResponse.json({ summary: data || [] });
  } catch (error) {
    console.error('Error fetching commission summary by type:', error);
    return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 });
  }
}
