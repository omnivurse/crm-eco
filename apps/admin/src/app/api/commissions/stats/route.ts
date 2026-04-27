import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { createCommissionService } from '@crm-eco/lib/commissions';
import type { Database } from '@crm-eco/lib/types';
import { getActiveTenant } from '@/lib/tenant';

/**
 * GET /api/commissions/stats
 * Get commission statistics for the organization
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Verify authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization
    const tenant = await getActiveTenant();
    if (!profile || !profile.role || !['owner', 'admin', 'staff'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get stats
    const commissionService = createCommissionService(supabase as any, tenant.organizationId);
    const stats = await commissionService.getCommissionStats();

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Commission stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
