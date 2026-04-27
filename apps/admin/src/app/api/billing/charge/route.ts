import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { createBillingService } from '@crm-eco/lib/billing';
import { z } from 'zod';
import { getActiveTenant } from '@/lib/tenant';
import { getAdminProfile } from '@/lib/profile';

const chargeSchema = z.object({
  memberId: z.string().uuid(),
  paymentProfileId: z.string().uuid(),
  amount: z.number().positive('Amount must be a positive number').max(100000, 'Amount cannot exceed $100,000'),
  description: z.string().optional(),
  invoiceNumber: z.string().optional(),
  billingScheduleId: z.string().uuid().optional().nullable(),
  enrollmentId: z.string().uuid().optional().nullable(),
  billingPeriodStart: z.string().optional().nullable(),
  billingPeriodEnd: z.string().optional().nullable(),
});

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
    if (!tenant || !['owner', 'admin', 'staff'].includes(tenant.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const profile = await getAdminProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = chargeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const {
      memberId,
      paymentProfileId,
      amount,
      description,
      invoiceNumber,
      billingScheduleId,
      enrollmentId,
      billingPeriodStart,
      billingPeriodEnd,
    } = parsed.data;

    // Verify member belongs to organization
    const { data: member } = await supabase
      .from('members')
      .select('id')
      .eq('id', memberId)
      .eq('organization_id', tenant.organizationId)
      .single() as { data: { id: string } | null };

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Process payment
    const billingService = createBillingService(supabase, tenant.organizationId);
    const result = await billingService.processPayment({
      memberId,
      organizationId: tenant.organizationId,
      paymentProfileId,
      amount,
      description,
      invoiceNumber,
      billingScheduleId: billingScheduleId ?? undefined,
      enrollmentId: enrollmentId ?? undefined,
      billingPeriodStart: billingPeriodStart ?? undefined,
      billingPeriodEnd: billingPeriodEnd ?? undefined,
    });

    if (result.success) {
      // Log activity
      await (supabase as any).rpc('log_admin_activity', {
        p_organization_id: tenant.organizationId,
        p_actor_profile_id: profile.id,
        p_entity_type: 'billing_transaction',
        p_entity_id: result.transactionId,
        p_action: 'charge',
        p_metadata: { amount, memberId, authorizeTransactionId: result.authorizeTransactionId },
      });

      return NextResponse.json({
        success: true,
        transactionId: result.transactionId,
        authorizeTransactionId: result.authorizeTransactionId,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.errorMessage,
          errorCode: result.errorCode,
          transactionId: result.transactionId,
        },
        { status: 422 }
      );
    }
  } catch (error) {
    console.error('Charge API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
