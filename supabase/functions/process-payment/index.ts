/**
 * Process Payment Edge Function
 *
 * Handles payment processing via Authorize.Net
 * Supports charging customer profiles and processing refunds
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChargeRequest {
  action: 'charge';
  memberId: string;
  paymentProfileId: string;
  amount: number;
  description?: string;
  invoiceNumber?: string;
  enrollmentId?: string;
  billingScheduleId?: string;
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
}

interface RefundRequest {
  action: 'refund';
  transactionId: string;
  amount: number;
  reason?: string;
}

interface CreateProfileRequest {
  action: 'create_profile';
  memberId: string;
  paymentMethod: {
    type: 'credit_card' | 'bank_account';
    cardNumber?: string;
    expirationDate?: string;
    cvv?: string;
    routingNumber?: string;
    accountNumber?: string;
    accountType?: 'checking' | 'savings';
    nameOnAccount?: string;
  };
  billingAddress?: {
    firstName: string;
    lastName: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  setAsDefault?: boolean;
}

type PaymentRequest = ChargeRequest | RefundRequest | CreateProfileRequest;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get auth token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get user's organization
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.organization_id) {
      return new Response(
        JSON.stringify({ error: 'Organization not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const organizationId = profile.organization_id;
    const body: PaymentRequest = await req.json();

    // Get Authorize.Net credentials
    const apiLoginId = Deno.env.get('AUTHORIZE_NET_API_LOGIN_ID');
    const transactionKey = Deno.env.get('AUTHORIZE_NET_TRANSACTION_KEY');
    const environment = Deno.env.get('AUTHORIZE_NET_ENVIRONMENT') || 'sandbox';

    if (!apiLoginId || !transactionKey) {
      return new Response(
        JSON.stringify({ error: 'Payment gateway not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiEndpoint = environment === 'production'
      ? 'https://api.authorize.net/xml/v1/request.api'
      : 'https://apitest.authorize.net/xml/v1/request.api';

    const merchantAuth = { name: apiLoginId, transactionKey };

    // Process based on action
    switch (body.action) {
      case 'charge': {
        return await processCharge(supabase, organizationId, body, merchantAuth, apiEndpoint);
      }
      case 'refund': {
        return await processRefund(supabase, organizationId, body, merchantAuth, apiEndpoint);
      }
      case 'create_profile': {
        return await createPaymentProfile(supabase, organizationId, body, merchantAuth, apiEndpoint);
      }
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Payment processing error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function processCharge(
  supabase: any,
  organizationId: string,
  input: ChargeRequest,
  merchantAuth: { name: string; transactionKey: string },
  apiEndpoint: string
) {
  // Get payment profile
  const { data: profile, error: profileError } = await supabase
    .from('payment_profiles')
    .select('*')
    .eq('id', input.paymentProfileId)
    .eq('is_active', true)
    .single();

  if (profileError || !profile) {
    return new Response(
      JSON.stringify({ success: false, error: 'Payment profile not found' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Create transaction record
  const { data: transaction, error: txnError } = await supabase
    .from('billing_transactions')
    .insert({
      organization_id: organizationId,
      member_id: input.memberId,
      enrollment_id: input.enrollmentId,
      payment_profile_id: input.paymentProfileId,
      billing_schedule_id: input.billingScheduleId,
      transaction_type: 'charge',
      amount: input.amount,
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
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to create transaction' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Charge via Authorize.Net
  const chargeResponse = await fetch(apiEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      createTransactionRequest: {
        merchantAuthentication: merchantAuth,
        transactionRequest: {
          transactionType: 'authCaptureTransaction',
          amount: input.amount.toFixed(2),
          profile: {
            customerProfileId: profile.authorize_customer_profile_id,
            paymentProfile: {
              paymentProfileId: profile.authorize_payment_profile_id,
            },
          },
          order: {
            invoiceNumber: input.invoiceNumber,
            description: input.description,
          },
        },
      },
    }),
  });

  const responseText = await chargeResponse.text();
  const response = JSON.parse(responseText.replace(/^\uFEFF/, ''));
  const txnResponse = response.transactionResponse;

  if (response.messages.resultCode === 'Ok' && txnResponse?.responseCode === '1') {
    // Update transaction as successful
    await supabase
      .from('billing_transactions')
      .update({
        status: 'success',
        authorize_transaction_id: txnResponse.transId,
        authorize_response_code: txnResponse.responseCode,
        authorize_auth_code: txnResponse.authCode,
        avs_response: txnResponse.avsResultCode,
        cvv_response: txnResponse.cvvResultCode,
        processed_at: new Date().toISOString(),
      })
      .eq('id', transaction.id);

    return new Response(
      JSON.stringify({
        success: true,
        transactionId: transaction.id,
        authorizeTransactionId: txnResponse.transId,
        authCode: txnResponse.authCode,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } else {
    const error = txnResponse?.errors?.[0] || response.messages.message[0];
    const errorCode = error?.errorCode || error?.code;
    const errorMessage = error?.errorText || error?.text;

    // Update transaction as failed
    await supabase
      .from('billing_transactions')
      .update({
        status: 'failed',
        authorize_transaction_id: txnResponse?.transId,
        authorize_response_code: txnResponse?.responseCode,
        error_code: errorCode,
        error_message: errorMessage,
        processed_at: new Date().toISOString(),
      })
      .eq('id', transaction.id);

    // Create billing failure record if schedule-based
    if (input.billingScheduleId) {
      await supabase.from('billing_failures').insert({
        organization_id: organizationId,
        billing_schedule_id: input.billingScheduleId,
        transaction_id: transaction.id,
        member_id: input.memberId,
        amount: input.amount,
        failure_reason: errorMessage,
        failure_code: errorCode,
        failed_at: new Date().toISOString(),
      });
    }

    return new Response(
      JSON.stringify({
        success: false,
        transactionId: transaction.id,
        errorCode,
        errorMessage,
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function processRefund(
  supabase: any,
  organizationId: string,
  input: RefundRequest,
  merchantAuth: { name: string; transactionKey: string },
  apiEndpoint: string
) {
  // Get original transaction
  const { data: originalTxn, error: txnError } = await supabase
    .from('billing_transactions')
    .select('*, payment_profiles(*)')
    .eq('id', input.transactionId)
    .single();

  if (txnError || !originalTxn) {
    return new Response(
      JSON.stringify({ success: false, error: 'Original transaction not found' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Create refund transaction record
  const { data: refundTxn, error: refundError } = await supabase
    .from('billing_transactions')
    .insert({
      organization_id: organizationId,
      member_id: originalTxn.member_id,
      enrollment_id: originalTxn.enrollment_id,
      payment_profile_id: originalTxn.payment_profile_id,
      transaction_type: 'refund',
      amount: -input.amount,
      status: 'processing',
      description: input.reason || 'Refund',
      submitted_at: new Date().toISOString(),
      metadata: { original_transaction_id: input.transactionId },
    })
    .select('id')
    .single();

  if (refundError || !refundTxn) {
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to create refund record' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Process refund via Authorize.Net
  const profile = originalTxn.payment_profiles;
  const refundResponse = await fetch(apiEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      createTransactionRequest: {
        merchantAuthentication: merchantAuth,
        transactionRequest: {
          transactionType: 'refundTransaction',
          amount: input.amount.toFixed(2),
          refTransId: originalTxn.authorize_transaction_id,
          profile: profile ? {
            customerProfileId: profile.authorize_customer_profile_id,
            paymentProfile: {
              paymentProfileId: profile.authorize_payment_profile_id,
            },
          } : undefined,
        },
      },
    }),
  });

  const responseText = await refundResponse.text();
  const response = JSON.parse(responseText.replace(/^\uFEFF/, ''));
  const txnResponse = response.transactionResponse;

  if (response.messages.resultCode === 'Ok' && txnResponse?.responseCode === '1') {
    // Update refund transaction as successful
    await supabase
      .from('billing_transactions')
      .update({
        status: 'success',
        authorize_transaction_id: txnResponse.transId,
        processed_at: new Date().toISOString(),
      })
      .eq('id', refundTxn.id);

    // Update original transaction if fully refunded
    if (input.amount >= originalTxn.amount) {
      await supabase
        .from('billing_transactions')
        .update({ status: 'refunded' })
        .eq('id', input.transactionId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        transactionId: refundTxn.id,
        authorizeTransactionId: txnResponse.transId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } else {
    const error = txnResponse?.errors?.[0] || response.messages.message[0];

    await supabase
      .from('billing_transactions')
      .update({
        status: 'failed',
        error_code: error?.errorCode || error?.code,
        error_message: error?.errorText || error?.text,
        processed_at: new Date().toISOString(),
      })
      .eq('id', refundTxn.id);

    return new Response(
      JSON.stringify({
        success: false,
        transactionId: refundTxn.id,
        errorCode: error?.errorCode || error?.code,
        errorMessage: error?.errorText || error?.text,
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function createPaymentProfile(
  supabase: any,
  organizationId: string,
  input: CreateProfileRequest,
  merchantAuth: { name: string; transactionKey: string },
  apiEndpoint: string
) {
  // Get member
  const { data: member, error: memberError } = await supabase
    .from('members')
    .select('id, email, first_name, last_name, customer_profile_id')
    .eq('id', input.memberId)
    .single();

  if (memberError || !member) {
    return new Response(
      JSON.stringify({ success: false, error: 'Member not found' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let customerProfileId = member.customer_profile_id;

  // Create customer profile if needed
  if (!customerProfileId) {
    const createProfileResponse = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        createCustomerProfileRequest: {
          merchantAuthentication: merchantAuth,
          profile: {
            merchantCustomerId: input.memberId,
            description: `${member.first_name} ${member.last_name}`,
            email: member.email,
          },
        },
      }),
    });

    const responseText = await createProfileResponse.text();
    const response = JSON.parse(responseText.replace(/^\uFEFF/, ''));

    if (response.messages.resultCode !== 'Ok') {
      return new Response(
        JSON.stringify({
          success: false,
          error: response.messages.message[0]?.text || 'Failed to create customer profile',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    customerProfileId = response.customerProfileId;

    // Save customer profile ID
    await supabase
      .from('members')
      .update({ customer_profile_id: customerProfileId })
      .eq('id', input.memberId);
  }

  // Build payment data
  let payment: any;
  if (input.paymentMethod.type === 'credit_card') {
    payment = {
      creditCard: {
        cardNumber: input.paymentMethod.cardNumber,
        expirationDate: input.paymentMethod.expirationDate,
        cardCode: input.paymentMethod.cvv,
      },
    };
  } else {
    payment = {
      bankAccount: {
        accountType: input.paymentMethod.accountType,
        routingNumber: input.paymentMethod.routingNumber,
        accountNumber: input.paymentMethod.accountNumber,
        nameOnAccount: input.paymentMethod.nameOnAccount,
      },
    };
  }

  // Create payment profile
  const createPaymentResponse = await fetch(apiEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      createCustomerPaymentProfileRequest: {
        merchantAuthentication: merchantAuth,
        customerProfileId,
        paymentProfile: {
          billTo: input.billingAddress ? {
            firstName: input.billingAddress.firstName,
            lastName: input.billingAddress.lastName,
            address: input.billingAddress.address,
            city: input.billingAddress.city,
            state: input.billingAddress.state,
            zip: input.billingAddress.zip,
            country: 'US',
          } : undefined,
          payment,
          defaultPaymentProfile: input.setAsDefault,
        },
        validationMode: 'liveMode',
      },
    }),
  });

  const responseText = await createPaymentResponse.text();
  const response = JSON.parse(responseText.replace(/^\uFEFF/, ''));

  if (response.messages.resultCode !== 'Ok') {
    return new Response(
      JSON.stringify({
        success: false,
        error: response.messages.message[0]?.text || 'Failed to create payment profile',
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const paymentProfileId = response.customerPaymentProfileId;

  // Get last 4 digits
  const lastFour = input.paymentMethod.type === 'credit_card'
    ? input.paymentMethod.cardNumber?.slice(-4)
    : input.paymentMethod.accountNumber?.slice(-4);

  // Detect card type if credit card
  let cardType: string | null = null;
  if (input.paymentMethod.type === 'credit_card' && input.paymentMethod.cardNumber) {
    const cardNum = input.paymentMethod.cardNumber;
    if (cardNum.startsWith('4')) cardType = 'Visa';
    else if (/^5[1-5]/.test(cardNum)) cardType = 'Mastercard';
    else if (/^3[47]/.test(cardNum)) cardType = 'Amex';
    else if (/^6(?:011|5)/.test(cardNum)) cardType = 'Discover';
  }

  // If setting as default, unset other defaults
  if (input.setAsDefault) {
    await supabase
      .from('payment_profiles')
      .update({ is_default: false })
      .eq('member_id', input.memberId)
      .eq('is_active', true);
  }

  // Save to database
  const { data: profile, error: saveError } = await supabase
    .from('payment_profiles')
    .insert({
      organization_id: organizationId,
      member_id: input.memberId,
      authorize_customer_profile_id: customerProfileId,
      authorize_payment_profile_id: paymentProfileId,
      payment_type: input.paymentMethod.type,
      last_four: lastFour,
      card_type: cardType,
      expiration_date: input.paymentMethod.expirationDate?.replace('-', '/').substring(2),
      account_type: input.paymentMethod.accountType,
      billing_first_name: input.billingAddress?.firstName,
      billing_last_name: input.billingAddress?.lastName,
      billing_address: input.billingAddress?.address,
      billing_city: input.billingAddress?.city,
      billing_state: input.billingAddress?.state,
      billing_zip: input.billingAddress?.zip,
      is_default: input.setAsDefault || false,
      is_active: true,
    })
    .select('id')
    .single();

  if (saveError || !profile) {
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to save payment profile' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      paymentProfileId: profile.id,
      lastFour,
      cardType,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
