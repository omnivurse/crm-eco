/**
 * Billing Service
 * 
 * High-level billing operations that coordinate between
 * Supabase database and Authorize.Net payment gateway.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClientAny = any;
import {
  AuthorizeNetService,
  createAuthorizeNetService,
  type PaymentMethod,
  type BillingAddress,
  maskNumber,
  detectCardType,
} from './authorize-net';

export interface PaymentProfileData {
  id: string;
  memberId: string;
  paymentType: 'credit_card' | 'bank_account';
  lastFour: string;
  cardType?: string;
  expirationDate?: string;
  accountType?: string;
  bankName?: string;
  billingFirstName?: string;
  billingLastName?: string;
  billingAddress?: string;
  billingCity?: string;
  billingState?: string;
  billingZip?: string;
  isDefault: boolean;
  isActive: boolean;
  nickname?: string;
  createdAt: string;
}

export interface BillingScheduleData {
  id: string;
  enrollmentId: string;
  memberId: string;
  paymentProfileId?: string;
  amount: number;
  frequency: 'monthly' | 'quarterly' | 'annual';
  billingDay: number;
  startDate: string;
  endDate?: string;
  nextBillingDate: string;
  lastBilledDate?: string;
  status: 'active' | 'paused' | 'cancelled' | 'completed';
  retryCount: number;
}

export interface TransactionData {
  id: string;
  memberId: string;
  enrollmentId?: string;
  transactionType: 'charge' | 'refund' | 'void' | 'adjustment';
  amount: number;
  processingFee: number;
  netAmount: number;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'voided' | 'refunded';
  authorizeTransactionId?: string;
  authorizeResponseCode?: string;
  errorMessage?: string;
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
  description?: string;
  invoiceNumber?: string;
  createdAt: string;
}

export interface CreatePaymentProfileInput {
  memberId: string;
  organizationId: string;
  paymentMethod: PaymentMethod;
  billingAddress?: BillingAddress;
  setAsDefault?: boolean;
  nickname?: string;
}

export interface ProcessPaymentInput {
  memberId: string;
  organizationId: string;
  paymentProfileId: string;
  amount: number;
  description?: string;
  invoiceNumber?: string;
  billingScheduleId?: string;
  enrollmentId?: string;
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
}

export interface ProcessPaymentResult {
  success: boolean;
  transactionId?: string;
  authorizeTransactionId?: string;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Billing Service Class
 */
export class BillingService {
  private supabase: SupabaseClientAny;
  private authorizeNet: AuthorizeNetService;
  private organizationId: string;

  constructor(supabase: SupabaseClientAny, organizationId: string) {
    this.supabase = supabase;
    this.organizationId = organizationId;
    this.authorizeNet = createAuthorizeNetService();
  }

  /**
   * Get or create Authorize.Net customer profile for a member
   */
  async getOrCreateCustomerProfile(memberId: string): Promise<string> {
    // Check if member already has a customer profile ID
    const { data: member, error: memberError } = await this.supabase
      .from('members')
      .select('id, email, first_name, last_name, customer_profile_id')
      .eq('id', memberId)
      .single();

    if (memberError || !member) {
      throw new Error('Member not found');
    }

    // Return existing profile ID if available
    if (member.customer_profile_id) {
      return member.customer_profile_id;
    }

    // Create new customer profile in Authorize.Net
    const createResult = await this.authorizeNet.createCustomerProfile({
      email: member.email,
      merchantCustomerId: memberId,
      description: `${member.first_name} ${member.last_name}`,
    });

    if (!createResult.success || !createResult.customerProfileId) {
      throw new Error(createResult.errorMessage || 'Failed to create customer profile');
    }

    // Save the customer profile ID to the member record
    await this.supabase
      .from('members')
      .update({ customer_profile_id: createResult.customerProfileId })
      .eq('id', memberId);

    return createResult.customerProfileId;
  }

  /**
   * Create a new payment profile for a member
   */
  async createPaymentProfile(input: CreatePaymentProfileInput): Promise<PaymentProfileData> {
    const customerProfileId = await this.getOrCreateCustomerProfile(input.memberId);

    // Create payment profile in Authorize.Net
    const createResult = await this.authorizeNet.createPaymentProfile({
      customerProfileId,
      paymentMethod: input.paymentMethod,
      billingAddress: input.billingAddress,
      defaultPaymentProfile: input.setAsDefault,
    });

    if (!createResult.success || !createResult.paymentProfileId) {
      throw new Error(createResult.errorMessage || 'Failed to create payment profile');
    }

    // Determine payment details to store
    const isCard = input.paymentMethod.type === 'credit_card';
    let lastFour: string;
    let cardType: string | undefined;
    
    if (input.paymentMethod.type === 'credit_card') {
      lastFour = maskNumber(input.paymentMethod.cardNumber);
      cardType = detectCardType(input.paymentMethod.cardNumber);
    } else {
      lastFour = maskNumber(input.paymentMethod.accountNumber);
      cardType = undefined;
    }

    // If setting as default, unset other defaults first
    if (input.setAsDefault) {
      await this.supabase
        .from('payment_profiles')
        .update({ is_default: false })
        .eq('member_id', input.memberId)
        .eq('is_active', true);
    }

    // Build payment profile data based on payment method type
    let expirationDate: string | null = null;
    let accountType: string | null = null;
    let bankName: string | null = null;
    
    if (input.paymentMethod.type === 'credit_card') {
      expirationDate = input.paymentMethod.expirationDate.replace('-', '/').substring(2);
    } else {
      accountType = input.paymentMethod.accountType;
      bankName = input.paymentMethod.bankName || null;
    }

    // Store in database
    const { data: profile, error } = await this.supabase
      .from('payment_profiles')
      .insert({
        organization_id: input.organizationId,
        member_id: input.memberId,
        authorize_customer_profile_id: customerProfileId,
        authorize_payment_profile_id: createResult.paymentProfileId,
        payment_type: input.paymentMethod.type,
        last_four: lastFour,
        card_type: cardType,
        expiration_date: expirationDate,
        account_type: accountType,
        bank_name: bankName,
        billing_first_name: input.billingAddress?.firstName,
        billing_last_name: input.billingAddress?.lastName,
        billing_address: input.billingAddress?.address,
        billing_city: input.billingAddress?.city,
        billing_state: input.billingAddress?.state,
        billing_zip: input.billingAddress?.zip,
        billing_country: input.billingAddress?.country || 'US',
        is_default: input.setAsDefault || false,
        is_active: true,
        nickname: input.nickname,
      })
      .select('*')
      .single();

    if (error || !profile) {
      throw new Error('Failed to save payment profile to database');
    }

    return this.mapPaymentProfile(profile);
  }

  /**
   * Get all payment profiles for a member
   */
  async getPaymentProfiles(memberId: string): Promise<PaymentProfileData[]> {
    const { data, error } = await this.supabase
      .from('payment_profiles')
      .select('*')
      .eq('member_id', memberId)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error('Failed to fetch payment profiles');
    }

    return (data || []).map(this.mapPaymentProfile);
  }

  /**
   * Delete a payment profile
   */
  async deletePaymentProfile(profileId: string): Promise<void> {
    // Get profile details
    const { data: profile, error: fetchError } = await this.supabase
      .from('payment_profiles')
      .select('*')
      .eq('id', profileId)
      .single();

    if (fetchError || !profile) {
      throw new Error('Payment profile not found');
    }

    // Delete from Authorize.Net
    const deleteResult = await this.authorizeNet.deletePaymentProfile(
      profile.authorize_customer_profile_id,
      profile.authorize_payment_profile_id
    );

    if (!deleteResult.success) {
      // Log but don't fail - we still want to mark as inactive in our DB
      console.error('Failed to delete from Authorize.Net:', deleteResult.errorMessage);
    }

    // Mark as inactive in database (soft delete)
    await this.supabase
      .from('payment_profiles')
      .update({ is_active: false, is_default: false })
      .eq('id', profileId);
  }

  /**
   * Set a payment profile as default
   */
  async setDefaultPaymentProfile(memberId: string, profileId: string): Promise<void> {
    // Unset all other defaults
    await this.supabase
      .from('payment_profiles')
      .update({ is_default: false })
      .eq('member_id', memberId)
      .eq('is_active', true);

    // Set new default
    await this.supabase
      .from('payment_profiles')
      .update({ is_default: true })
      .eq('id', profileId);
  }

  /**
   * Process a payment
   */
  async processPayment(input: ProcessPaymentInput): Promise<ProcessPaymentResult> {
    // Get payment profile
    const { data: profile, error: profileError } = await this.supabase
      .from('payment_profiles')
      .select('*')
      .eq('id', input.paymentProfileId)
      .eq('is_active', true)
      .single();

    if (profileError || !profile) {
      return {
        success: false,
        errorCode: 'PROFILE_NOT_FOUND',
        errorMessage: 'Payment profile not found or inactive',
      };
    }

    // Create transaction record (pending)
    const { data: transaction, error: txnError } = await this.supabase
      .from('billing_transactions')
      .insert({
        organization_id: input.organizationId,
        billing_schedule_id: input.billingScheduleId,
        member_id: input.memberId,
        enrollment_id: input.enrollmentId,
        payment_profile_id: input.paymentProfileId,
        transaction_type: 'charge',
        amount: input.amount,
        processing_fee: profile.payment_type === 'credit_card' ? input.amount * 0.029 : 0,
        status: 'processing',
        description: input.description,
        invoice_number: input.invoiceNumber,
        billing_period_start: input.billingPeriodStart,
        billing_period_end: input.billingPeriodEnd,
        submitted_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (txnError || !transaction) {
      return {
        success: false,
        errorCode: 'DB_ERROR',
        errorMessage: 'Failed to create transaction record',
      };
    }

    // Charge via Authorize.Net
    const chargeResult = await this.authorizeNet.chargeCustomerProfile({
      customerProfileId: profile.authorize_customer_profile_id,
      paymentProfileId: profile.authorize_payment_profile_id,
      amount: input.amount,
      description: input.description,
      invoiceNumber: input.invoiceNumber,
    });

    // Update transaction with result
    if (chargeResult.success) {
      await this.supabase
        .from('billing_transactions')
        .update({
          status: 'success',
          authorize_transaction_id: chargeResult.transactionId,
          authorize_response_code: chargeResult.responseCode,
          authorize_auth_code: chargeResult.authCode,
          avs_response: chargeResult.avsResultCode,
          cvv_response: chargeResult.cvvResultCode,
          processed_at: new Date().toISOString(),
        })
        .eq('id', transaction.id);

      // Update billing schedule if applicable
      if (input.billingScheduleId) {
        await this.updateBillingScheduleAfterSuccess(input.billingScheduleId);
      }

      return {
        success: true,
        transactionId: transaction.id,
        authorizeTransactionId: chargeResult.transactionId,
      };
    } else {
      await this.supabase
        .from('billing_transactions')
        .update({
          status: 'failed',
          authorize_transaction_id: chargeResult.transactionId,
          authorize_response_code: chargeResult.responseCode,
          error_code: chargeResult.errorCode,
          error_message: chargeResult.errorMessage,
          processed_at: new Date().toISOString(),
        })
        .eq('id', transaction.id);

      // Create billing failure record if schedule-based
      if (input.billingScheduleId) {
        await this.createBillingFailure(
          input.billingScheduleId,
          transaction.id,
          input.memberId,
          input.amount,
          chargeResult.errorMessage || 'Payment declined',
          chargeResult.errorCode
        );
      }

      return {
        success: false,
        transactionId: transaction.id,
        authorizeTransactionId: chargeResult.transactionId,
        errorCode: chargeResult.errorCode,
        errorMessage: chargeResult.errorMessage,
      };
    }
  }

  /**
   * Process a refund
   */
  async processRefund(
    transactionId: string,
    amount: number,
    reason?: string
  ): Promise<ProcessPaymentResult> {
    // Get original transaction
    const { data: originalTxn, error: txnError } = await this.supabase
      .from('billing_transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('status', 'success')
      .single();

    if (txnError || !originalTxn) {
      return {
        success: false,
        errorCode: 'TXN_NOT_FOUND',
        errorMessage: 'Original transaction not found or not eligible for refund',
      };
    }

    // Get payment profile for refund
    const { data: profile } = await this.supabase
      .from('payment_profiles')
      .select('*')
      .eq('id', originalTxn.payment_profile_id)
      .single();

    // Create refund transaction record
    const { data: refundTxn, error: refundError } = await this.supabase
      .from('billing_transactions')
      .insert({
        organization_id: originalTxn.organization_id,
        member_id: originalTxn.member_id,
        enrollment_id: originalTxn.enrollment_id,
        payment_profile_id: originalTxn.payment_profile_id,
        transaction_type: 'refund',
        amount: -amount,
        status: 'processing',
        description: reason || 'Refund',
        submitted_at: new Date().toISOString(),
        metadata: { original_transaction_id: transactionId },
      })
      .select('id')
      .single();

    if (refundError || !refundTxn) {
      return {
        success: false,
        errorCode: 'DB_ERROR',
        errorMessage: 'Failed to create refund record',
      };
    }

    // Process refund via Authorize.Net
    const refundResult = await this.authorizeNet.refundTransaction({
      transactionId: originalTxn.authorize_transaction_id,
      amount,
      customerProfileId: profile?.authorize_customer_profile_id,
      paymentProfileId: profile?.authorize_payment_profile_id,
    });

    if (refundResult.success) {
      // Update refund transaction
      await this.supabase
        .from('billing_transactions')
        .update({
          status: 'success',
          authorize_transaction_id: refundResult.transactionId,
          processed_at: new Date().toISOString(),
        })
        .eq('id', refundTxn.id);

      // Update original transaction status if fully refunded
      if (amount >= originalTxn.amount) {
        await this.supabase
          .from('billing_transactions')
          .update({ status: 'refunded' })
          .eq('id', transactionId);
      }

      return {
        success: true,
        transactionId: refundTxn.id,
        authorizeTransactionId: refundResult.transactionId,
      };
    } else {
      await this.supabase
        .from('billing_transactions')
        .update({
          status: 'failed',
          error_code: refundResult.errorCode,
          error_message: refundResult.errorMessage,
          processed_at: new Date().toISOString(),
        })
        .eq('id', refundTxn.id);

      return {
        success: false,
        transactionId: refundTxn.id,
        errorCode: refundResult.errorCode,
        errorMessage: refundResult.errorMessage,
      };
    }
  }

  /**
   * Get transactions for a member
   */
  async getTransactions(
    memberId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<TransactionData[]> {
    let query = this.supabase
      .from('billing_transactions')
      .select('*')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error('Failed to fetch transactions');
    }

    return (data || []).map(this.mapTransaction);
  }

  /**
   * Get billing schedules for a member
   */
  async getBillingSchedules(memberId: string): Promise<BillingScheduleData[]> {
    const { data, error } = await this.supabase
      .from('billing_schedules')
      .select('*')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error('Failed to fetch billing schedules');
    }

    return (data || []).map(this.mapBillingSchedule);
  }

  /**
   * Create a billing schedule
   */
  async createBillingSchedule(
    enrollmentId: string,
    memberId: string,
    paymentProfileId: string,
    amount: number,
    billingDay: number,
    startDate: string,
    frequency: 'monthly' | 'quarterly' | 'annual' = 'monthly'
  ): Promise<BillingScheduleData> {
    const nextBillingDate = this.calculateNextBillingDate(new Date(startDate), billingDay, frequency);

    const { data, error } = await this.supabase
      .from('billing_schedules')
      .insert({
        organization_id: this.organizationId,
        enrollment_id: enrollmentId,
        member_id: memberId,
        payment_profile_id: paymentProfileId,
        amount,
        frequency,
        billing_day: billingDay,
        start_date: startDate,
        next_billing_date: nextBillingDate.toISOString().split('T')[0],
        status: 'active',
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error('Failed to create billing schedule');
    }

    return this.mapBillingSchedule(data);
  }

  /**
   * Pause a billing schedule
   */
  async pauseBillingSchedule(scheduleId: string, reason?: string): Promise<void> {
    await this.supabase
      .from('billing_schedules')
      .update({
        status: 'paused',
        pause_reason: reason,
        paused_at: new Date().toISOString(),
      })
      .eq('id', scheduleId);
  }

  /**
   * Resume a billing schedule
   */
  async resumeBillingSchedule(scheduleId: string): Promise<void> {
    const { data: schedule } = await this.supabase
      .from('billing_schedules')
      .select('*')
      .eq('id', scheduleId)
      .single();

    if (!schedule) {
      throw new Error('Schedule not found');
    }

    const nextBillingDate = this.calculateNextBillingDate(
      new Date(),
      schedule.billing_day,
      schedule.frequency
    );

    await this.supabase
      .from('billing_schedules')
      .update({
        status: 'active',
        pause_reason: null,
        paused_at: null,
        next_billing_date: nextBillingDate.toISOString().split('T')[0],
      })
      .eq('id', scheduleId);
  }

  /**
   * Cancel a billing schedule
   */
  async cancelBillingSchedule(scheduleId: string, reason?: string): Promise<void> {
    await this.supabase
      .from('billing_schedules')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_reason: reason,
      })
      .eq('id', scheduleId);
  }

  // Private helper methods

  private async updateBillingScheduleAfterSuccess(scheduleId: string): Promise<void> {
    const { data: schedule } = await this.supabase
      .from('billing_schedules')
      .select('*')
      .eq('id', scheduleId)
      .single();

    if (!schedule) return;

    const nextBillingDate = this.calculateNextBillingDate(
      new Date(schedule.next_billing_date),
      schedule.billing_day,
      schedule.frequency
    );

    await this.supabase
      .from('billing_schedules')
      .update({
        last_billed_date: schedule.next_billing_date,
        next_billing_date: nextBillingDate.toISOString().split('T')[0],
        retry_count: 0,
      })
      .eq('id', scheduleId);
  }

  private async createBillingFailure(
    scheduleId: string,
    transactionId: string,
    memberId: string,
    amount: number,
    reason: string,
    code?: string
  ): Promise<void> {
    const { data: schedule } = await this.supabase
      .from('billing_schedules')
      .select('retry_count, max_retries')
      .eq('id', scheduleId)
      .single();

    const retryAttempt = (schedule?.retry_count || 0) + 1;
    const nextRetryDate = new Date();
    nextRetryDate.setDate(nextRetryDate.getDate() + Math.min(retryAttempt * 3, 14)); // Exponential backoff, max 14 days

    await this.supabase.from('billing_failures').insert({
      organization_id: this.organizationId,
      billing_schedule_id: scheduleId,
      billing_transaction_id: transactionId,
      member_id: memberId,
      failure_reason: reason,
      failure_code: code,
      amount,
      retry_attempt: retryAttempt,
      next_retry_date: nextRetryDate.toISOString().split('T')[0],
      retry_scheduled: retryAttempt < (schedule?.max_retries || 3),
    });

    // Update schedule retry count
    await this.supabase
      .from('billing_schedules')
      .update({ retry_count: retryAttempt })
      .eq('id', scheduleId);
  }

  private calculateNextBillingDate(
    fromDate: Date,
    billingDay: number,
    frequency: string
  ): Date {
    const next = new Date(fromDate);
    const targetDay = Math.min(billingDay, 28);

    switch (frequency) {
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
      case 'quarterly':
        next.setMonth(next.getMonth() + 3);
        break;
      case 'annual':
        next.setFullYear(next.getFullYear() + 1);
        break;
    }

    next.setDate(targetDay);
    return next;
  }

  private mapPaymentProfile(row: Record<string, unknown>): PaymentProfileData {
    return {
      id: row.id as string,
      memberId: row.member_id as string,
      paymentType: row.payment_type as 'credit_card' | 'bank_account',
      lastFour: row.last_four as string,
      cardType: row.card_type as string | undefined,
      expirationDate: row.expiration_date as string | undefined,
      accountType: row.account_type as string | undefined,
      bankName: row.bank_name as string | undefined,
      billingFirstName: row.billing_first_name as string | undefined,
      billingLastName: row.billing_last_name as string | undefined,
      billingAddress: row.billing_address as string | undefined,
      billingCity: row.billing_city as string | undefined,
      billingState: row.billing_state as string | undefined,
      billingZip: row.billing_zip as string | undefined,
      isDefault: row.is_default as boolean,
      isActive: row.is_active as boolean,
      nickname: row.nickname as string | undefined,
      createdAt: row.created_at as string,
    };
  }

  private mapBillingSchedule(row: Record<string, unknown>): BillingScheduleData {
    return {
      id: row.id as string,
      enrollmentId: row.enrollment_id as string,
      memberId: row.member_id as string,
      paymentProfileId: row.payment_profile_id as string | undefined,
      amount: row.amount as number,
      frequency: row.frequency as 'monthly' | 'quarterly' | 'annual',
      billingDay: row.billing_day as number,
      startDate: row.start_date as string,
      endDate: row.end_date as string | undefined,
      nextBillingDate: row.next_billing_date as string,
      lastBilledDate: row.last_billed_date as string | undefined,
      status: row.status as 'active' | 'paused' | 'cancelled' | 'completed',
      retryCount: row.retry_count as number,
    };
  }

  private mapTransaction(row: Record<string, unknown>): TransactionData {
    return {
      id: row.id as string,
      memberId: row.member_id as string,
      enrollmentId: row.enrollment_id as string | undefined,
      transactionType: row.transaction_type as 'charge' | 'refund' | 'void' | 'adjustment',
      amount: row.amount as number,
      processingFee: row.processing_fee as number,
      netAmount: row.net_amount as number,
      status: row.status as 'pending' | 'processing' | 'success' | 'failed' | 'voided' | 'refunded',
      authorizeTransactionId: row.authorize_transaction_id as string | undefined,
      authorizeResponseCode: row.authorize_response_code as string | undefined,
      errorMessage: row.error_message as string | undefined,
      billingPeriodStart: row.billing_period_start as string | undefined,
      billingPeriodEnd: row.billing_period_end as string | undefined,
      description: row.description as string | undefined,
      invoiceNumber: row.invoice_number as string | undefined,
      createdAt: row.created_at as string,
    };
  }
}

/**
 * Factory function to create billing service
 */
export function createBillingService(
  supabase: SupabaseClientAny,
  organizationId: string
): BillingService {
  return new BillingService(supabase, organizationId);
}
