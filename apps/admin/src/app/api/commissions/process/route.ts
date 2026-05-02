import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { createCommissionService } from '@crm-eco/lib/commissions';
import type { Database } from '@crm-eco/lib/types';
import { getActiveTenant } from '@/lib/tenant';
import { getAdminProfile } from '@/lib/profile';

/**
 * POST /api/commissions/process
 * Process commissions for an enrollment.
 *
 * Wrapped in a 25s timeout so a hung Postgres lock can't starve the Vercel
 * function pool. Vercel kills hobby/pro routes at 30s anyway; finishing on
 * our own timer with a clean 504 keeps clients from seeing a generic
 * gateway error and gives us a logged "timeout" signal we can monitor.
 */
const PROCESS_TIMEOUT_MS = 25_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out after ${ms}ms: ${label}`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Verify authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization
    const tenant = await getActiveTenant();
    if (!tenant || !tenant.role || !['owner', 'admin'].includes(tenant.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const profile = await getAdminProfile();
    if (!profile) {
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
      .eq('organization_id', tenant.organizationId)
      .single();

    if (!enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    // Process commissions with a hard timeout so a slow Postgres lock
    // doesn't take down the Vercel function pool.
    const commissionService = createCommissionService(supabase as any, tenant.organizationId);
    const transactions = await withTimeout(
      commissionService.processEnrollmentCommissions(enrollmentId),
      PROCESS_TIMEOUT_MS,
      `processEnrollmentCommissions(${enrollmentId})`,
    );

    // Log activity
    await (supabase as any).rpc('log_admin_activity', {
      p_organization_id: tenant.organizationId,
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
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Commission process error:', message);
    if (message.startsWith('Timed out')) {
      return NextResponse.json(
        { error: 'Commission processing timed out. Please retry.' },
        { status: 504 },
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
