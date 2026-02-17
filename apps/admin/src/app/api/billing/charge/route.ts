import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { createBillingService } from '@crm-eco/lib/billing';
import { z } from 'zod';

const chargeSchema = z.object({
  memberId: z.string().uuid(),
  paymentProfileId: z.string().uuid(),
  amount: z.number().positive('Amount must be a positive number'),
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
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id, role')
      .eq('user_id', user.id)
      .single() as { data: { id: string; organization_id: string; role: string } | null };

    if (!profile || !['owner', 'admin', 'staff'].includes(profile.role)) {
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
      .eq('organization_id', profile.organization_id)
      .single() as { data: { id: string } | null };

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Process payment
    const billingService = createBillingService(supabase, profile.organization_id);
    const result = await billingService.processPayment({
      memberId,
      organizationId: profile.organization_id,
      paymentProfileId,
      amount,
      description,
      invoiceNumber,
      billingScheduleId,
      enrollmentId,
      billingPeriodStart,
      billingPeriodEnd,
    });

    if (result.success) {
      // Log activity
      await (supabase as any).rpc('log_admin_activity', {
        p_organization_id: profile.organization_id,
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
