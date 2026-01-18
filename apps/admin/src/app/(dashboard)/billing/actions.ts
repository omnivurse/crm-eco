'use server';

import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { createAuthorizeNetService } from '@crm-eco/lib/billing/authorize-net';

interface RetryPaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

export async function retryFailedPayment(failureId: string): Promise<RetryPaymentResult> {
  try {
    const supabase = await createServerSupabaseClient();

    // Get current user and verify access
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    // Get the failure record with related data
    const { data: failure, error: failureError } = await supabase
      .from('billing_failures')
      .select(`
        *,
        member:members(
          id,
          first_name,
          last_name,
          email,
          authorize_customer_profile_id
        ),
        billing_schedule:billing_schedules(
          id,
          payment_profile_id,
          payment_profile:payment_profiles(
            id,
            authorize_payment_profile_id
          )
        )
      `)
      .eq('id', failureId)
      .eq('organization_id', profile.organization_id)
      .single();

    if (failureError || !failure) {
      return { success: false, error: 'Billing failure not found' };
    }

    if (failure.resolved) {
      return { success: false, error: 'This failure has already been resolved' };
    }

    // Get payment profile info
    const member = failure.member;
    const paymentProfile = failure.billing_schedule?.payment_profile;

    if (!member?.authorize_customer_profile_id) {
      return { success: false, error: 'Member does not have a payment profile configured' };
    }

    if (!paymentProfile?.authorize_payment_profile_id) {
      return { success: false, error: 'No payment profile found for this billing schedule' };
    }

    // Initialize Authorize.Net service
    const authNet = createAuthorizeNetService();

    // Attempt to charge the customer profile
    const chargeResult = await authNet.chargeCustomerProfile({
      customerProfileId: member.authorize_customer_profile_id,
      paymentProfileId: paymentProfile.authorize_payment_profile_id,
      amount: failure.amount,
      invoiceNumber: `RETRY-${failure.id.substring(0, 8)}`,
      description: `Retry payment for billing failure`,
    });

    if (chargeResult.success && chargeResult.transactionId) {
      // Payment succeeded - create transaction record
      await supabase
        .from('billing_transactions')
        .insert({
          organization_id: profile.organization_id,
          member_id: failure.member_id,
          billing_schedule_id: failure.billing_schedule_id,
          payment_profile_id: paymentProfile.id,
          transaction_type: 'charge',
          amount: failure.amount,
          processing_fee: 0,
          status: 'success',
          authorize_transaction_id: chargeResult.transactionId,
          auth_code: chargeResult.authCode,
          description: `Retry payment for failed billing`,
          processed_at: new Date().toISOString(),
        });

      // Mark failure as resolved
      await supabase
        .from('billing_failures')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: profile.id,
          resolution_type: 'retry_success',
          retry_scheduled: false,
        })
        .eq('id', failureId);

      return {
        success: true,
        transactionId: chargeResult.transactionId,
      };
    } else {
      // Payment failed again - update retry attempt
      const newRetryAttempt = (failure.retry_attempt || 0) + 1;
      const maxRetries = 3;

      // Calculate next retry date (exponential backoff: 1 day, 3 days, 7 days)
      const retryDelays = [1, 3, 7];
      const nextRetryDays = retryDelays[Math.min(newRetryAttempt, retryDelays.length - 1)];
      const nextRetryDate = new Date();
      nextRetryDate.setDate(nextRetryDate.getDate() + nextRetryDays);

      await supabase
        .from('billing_failures')
        .update({
          retry_attempt: newRetryAttempt,
          failure_reason: chargeResult.errorMessage || 'Payment declined',
          failure_code: chargeResult.errorCode,
          retry_scheduled: newRetryAttempt < maxRetries,
          next_retry_date: newRetryAttempt < maxRetries ? nextRetryDate.toISOString() : null,
          last_retry_at: new Date().toISOString(),
        })
        .eq('id', failureId);

      // Create failed transaction record
      await supabase
        .from('billing_transactions')
        .insert({
          organization_id: profile.organization_id,
          member_id: failure.member_id,
          billing_schedule_id: failure.billing_schedule_id,
          payment_profile_id: paymentProfile.id,
          transaction_type: 'charge',
          amount: failure.amount,
          processing_fee: 0,
          status: 'failed',
          authorize_transaction_id: chargeResult.transactionId,
          error_message: chargeResult.errorMessage,
          description: `Retry payment attempt ${newRetryAttempt} failed`,
          processed_at: new Date().toISOString(),
        });

      return {
        success: false,
        error: chargeResult.errorMessage || 'Payment was declined',
      };
    }
  } catch (error) {
    console.error('Error retrying payment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

export async function sendFailureNotification(failureId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    // Get the failure with member details
    const { data: failure } = await supabase
      .from('billing_failures')
      .select(`
        *,
        member:members(first_name, last_name, email)
      `)
      .eq('id', failureId)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!failure) {
      return { success: false, error: 'Failure not found' };
    }

    // Update notification status
    await supabase
      .from('billing_failures')
      .update({
        member_notified: true,
        notification_count: (failure.notification_count || 0) + 1,
        last_notification_at: new Date().toISOString(),
      })
      .eq('id', failureId);

    return { success: true };
  } catch (error) {
    console.error('Error sending notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An error occurred',
    };
  }
}
