import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { createBillingService } from '@crm-eco/lib/billing';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Verify authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization - only admin/owner can process refunds
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id, role')
      .eq('user_id', user.id)
      .single() as { data: { id: string; organization_id: string; role: string } | null };

    if (!profile || !['owner', 'admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Only admins and owners can process refunds' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { transactionId, amount, reason } = body;

    // Validate required fields
    if (!transactionId || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: transactionId, amount' },
        { status: 400 }
      );
    }

    // Verify transaction belongs to organization
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: transaction } = await (supabase as any)
      .from('billing_transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('organization_id', profile.organization_id)
      .eq('status', 'success')
      .single() as { data: { id: string; amount: number } | null };

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found or not eligible for refund' },
        { status: 404 }
      );
    }

    if (amount > transaction.amount) {
      return NextResponse.json(
        { error: 'Refund amount cannot exceed original transaction amount' },
        { status: 400 }
      );
    }

    // Process refund
    const billingService = createBillingService(supabase, profile.organization_id);
    const result = await billingService.processRefund(transactionId, amount, reason);

    if (result.success) {
      // Log activity
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).rpc('log_admin_activity', {
        p_organization_id: profile.organization_id,
        p_actor_profile_id: profile.id,
        p_entity_type: 'billing_transaction',
        p_entity_id: result.transactionId,
        p_action: 'refund',
        p_metadata: {
          amount,
          originalTransactionId: transactionId,
          reason,
          authorizeTransactionId: result.authorizeTransactionId,
        },
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
        },
        { status: 422 }
      );
    }
  } catch (error) {
    console.error('Refund API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
