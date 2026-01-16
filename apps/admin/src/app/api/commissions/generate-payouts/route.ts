import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { createCommissionService } from '@crm-eco/lib/commissions';
import type { Database } from '@crm-eco/lib/types';

/**
 * POST /api/commissions/generate-payouts
 * Generate payout records from approved commission transactions
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Verify authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization - only admin/owner can generate payouts
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id, role')
      .eq('user_id', user.id)
      .single() as { data: Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'organization_id' | 'role'> | null };

    if (!profile || !['owner', 'admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Only admins and owners can generate payouts' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { periodStart, periodEnd } = body;

    // Default to last month if not specified
    const now = new Date();
    const start = periodStart 
      ? new Date(periodStart)
      : new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = periodEnd
      ? new Date(periodEnd)
      : new Date(now.getFullYear(), now.getMonth(), 0);

    // Generate payouts
    const commissionService = createCommissionService(supabase as any, profile.organization_id);
    const createdCount = await commissionService.generatePayouts(start, end);

    // Log activity
    await (supabase as any).rpc('log_admin_activity', {
      p_organization_id: profile.organization_id,
      p_actor_profile_id: profile.id,
      p_entity_type: 'commission_payout',
      p_entity_id: 'batch',
      p_action: 'generate_payouts',
      p_metadata: { 
        payoutCount: createdCount,
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      payoutCount: createdCount,
      periodStart: start.toISOString().split('T')[0],
      periodEnd: end.toISOString().split('T')[0],
    });
  } catch (error) {
    console.error('Generate payouts error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
