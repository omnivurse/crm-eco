import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { createCommissionService } from '@crm-eco/lib/commissions';
import type { Database } from '@crm-eco/lib/types';

/**
 * POST /api/commissions/process
 * Process commissions for an enrollment
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Verify authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id, role')
      .eq('user_id', user.id)
      .single() as { data: Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'organization_id' | 'role'> | null };

    if (!profile || !['owner', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { enrollmentId } = body;

    if (!enrollmentId) {
      return NextResponse.json(
        { error: 'Missing required field: enrollmentId' },
        { status: 400 }
      );
    }

    // Verify enrollment belongs to organization
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id, organization_id')
      .eq('id', enrollmentId)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    // Process commissions
    const commissionService = createCommissionService(supabase as any, profile.organization_id);
    const transactions = await commissionService.processEnrollmentCommissions(enrollmentId);

    // Log activity
    await (supabase as any).rpc('log_admin_activity', {
      p_organization_id: profile.organization_id,
      p_actor_profile_id: profile.id,
      p_entity_type: 'commission_transaction',
      p_entity_id: enrollmentId,
      p_action: 'process_enrollment',
      p_metadata: { 
        transactionCount: transactions.length,
        enrollmentId,
      },
    });

    return NextResponse.json({
      success: true,
      transactionCount: transactions.length,
      transactions: transactions.map(t => ({
        id: t.id,
        advisorId: t.advisor_id,
        amount: t.commission_amount,
        type: t.transaction_type,
      })),
    });
  } catch (error) {
    console.error('Commission process error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
