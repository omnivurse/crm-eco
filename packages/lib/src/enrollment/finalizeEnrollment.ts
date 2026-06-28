/**
 * finalizeEnrollment — the service-role orchestration that runs once payment is
 * captured at enrollment completion (the PIFH gold-standard flow):
 *
 *   1. Vault the payment method via the provider seam (placeholder until the new
 *      bank adapter lands — see billing/payment-provider.ts).
 *   2. Persist it to payment_profiles (gateway ids go in the authorize_* columns,
 *      which are NOT NULL regardless of processor).
 *   3. Charge MONTH 1 immediately (idempotent by enrollment).
 *   4. Record the charge in billing_transactions.
 *   5. finalize_member_enrollment_tx → membership (effective the 1st) + billing
 *      schedule on the "1st" model, next charge = following month (no double-pay).
 *   6. Invite the member to the portal (set-password) — non-fatal, idempotent.
 *   7. Email the member + the agent (enrollment.advisor_id, else the PIFH org
 *      default agent) — non-fatal.
 *
 * MONEY-SAFETY: month 1 is charged BEFORE finalize; a declined charge aborts
 * before any membership/schedule is created. Retries reuse the same idempotency
 * key, so a re-run never double-charges or double-provisions.
 *
 * `service` MUST be a service-role client (finalize RPC + auth admin are
 * service-role-only); the caller authorizes first.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getPaymentProvider,
  type PaymentMethodInput,
  type PaymentBillingAddress,
} from '../billing/payment-provider';
import { onboardMemberLogin } from '../members/memberOnboarding';
import {
  sendEnrollmentConfirmationEmail,
  sendAdvisorNotificationEmail,
} from '../email/transactional';

export interface FinalizeEnrollmentInput {
  organizationId: string;
  enrollmentId: string;
  memberId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  /** First-month charge amount, in integer cents. */
  amountCents: number;
  paymentMethod: PaymentMethodInput;
  billingAddress?: PaymentBillingAddress;
  planName?: string;
  organizationName: string;
  /** Coverage start (a 1st); RPC defaults to the 1st of next month when omitted. */
  effectiveDate?: string | null;
  /** Where the portal invite set-password link returns to. */
  portalRedirectTo?: string;
}

export interface FinalizeEnrollmentResult {
  success: boolean;
  error?: string;
  stage?: 'vault' | 'charge' | 'finalize' | 'done';
  paymentProfileId?: string;
  transactionId?: string;
  membershipId?: string;
  billingScheduleId?: string;
  effectiveDate?: string;
  nextBillingDate?: string;
  portalInvited?: boolean;
  memberEmailSent?: boolean;
  agentEmailSent?: boolean;
  /** True when the placeholder provider was used (no real money moved). */
  placeholderPayment?: boolean;
}

export async function finalizeEnrollment(
  service: SupabaseClient,
  input: FinalizeEnrollmentInput,
): Promise<FinalizeEnrollmentResult> {
  const provider = getPaymentProvider();
  // Untyped client (the lib doesn't carry generated DB types); use it directly —
  // its query builders accept the dynamic table/column shapes below.
  const sb = service;
  const fullName = `${input.firstName} ${input.lastName}`.trim();

  // 1) Vault the payment method at the gateway.
  const vault = await provider.vaultPaymentMethod({
    organizationId: input.organizationId,
    memberId: input.memberId,
    email: input.email,
    method: input.paymentMethod,
    billingAddress: input.billingAddress,
  });
  if (!vault.success || !vault.gatewayCustomerId || !vault.gatewayPaymentProfileId) {
    return { success: false, stage: 'vault', error: vault.error ?? 'Payment method could not be saved.' };
  }
  const paymentType =
    vault.paymentType ?? (input.paymentMethod.type === 'ach' ? 'bank_account' : 'credit_card');

  // 2) Persist the vaulted profile (make it the member's default).
  await sb.from('payment_profiles').update({ is_default: false }).eq('member_id', input.memberId).eq('is_active', true);
  const { data: profile, error: profErr } = await sb
    .from('payment_profiles')
    .insert({
      organization_id: input.organizationId,
      member_id: input.memberId,
      authorize_customer_profile_id: vault.gatewayCustomerId,
      authorize_payment_profile_id: vault.gatewayPaymentProfileId,
      payment_type: paymentType,
      last_four: vault.lastFour ?? '0000',
      card_type: paymentType === 'credit_card' ? (vault.brand ?? null) : null,
      expiration_date: vault.expiration ?? null,
      bank_name: paymentType === 'bank_account' ? (vault.brand ?? null) : null,
      billing_first_name: input.billingAddress?.firstName ?? input.firstName,
      billing_last_name: input.billingAddress?.lastName ?? input.lastName,
      billing_address: input.billingAddress?.line1 ?? null,
      billing_city: input.billingAddress?.city ?? null,
      billing_state: input.billingAddress?.state ?? null,
      billing_zip: input.billingAddress?.zip ?? null,
      is_default: true,
      is_active: true,
      status: 'active',
    })
    .select('id')
    .single();
  if (profErr || !profile?.id) {
    return { success: false, stage: 'vault', error: profErr?.message ?? 'Could not store the payment profile.' };
  }
  const paymentProfileId = profile.id as string;

  // 3) Charge month 1 (idempotent).
  const idem = `enroll_first_${input.enrollmentId}`;
  const charge = await provider.chargeOnce({
    organizationId: input.organizationId,
    memberId: input.memberId,
    gatewayCustomerId: vault.gatewayCustomerId,
    gatewayPaymentProfileId: vault.gatewayPaymentProfileId,
    amountCents: input.amountCents,
    description: `First month — ${fullName}`,
    idempotencyKey: idem,
  });

  // 4) Record the transaction (unique idempotency_key prevents duplicates).
  try {
    await sb.from('billing_transactions').insert({
      organization_id: input.organizationId,
      member_id: input.memberId,
      enrollment_id: input.enrollmentId,
      payment_profile_id: paymentProfileId,
      transaction_type: 'charge',
      amount: input.amountCents / 100,
      status: charge.success ? 'success' : 'failed',
      authorize_transaction_id: charge.transactionId ?? null,
      error_message: charge.success ? null : (charge.error ?? null),
      description: `First month — ${fullName}`,
      submitted_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
      idempotency_key: idem,
    });
  } catch (e) {
    console.error('[finalizeEnrollment] billing_transactions insert failed (non-fatal)', e);
  }

  if (!charge.success) {
    return {
      success: false,
      stage: 'charge',
      error: charge.error ?? 'The payment was declined.',
      paymentProfileId,
      placeholderPayment: vault.placeholder,
    };
  }

  // 5) Provision membership + billing schedule (charge-first model).
  const { data: fin, error: finErr } = await sb.rpc('finalize_member_enrollment_tx', {
    p_org_id: input.organizationId,
    p_enrollment_id: input.enrollmentId,
    p_payment_profile_id: paymentProfileId,
    p_effective_date: input.effectiveDate ?? null,
    p_charged_first_month: true,
  });
  if (finErr) {
    return {
      success: false,
      stage: 'finalize',
      error: finErr.message,
      paymentProfileId,
      transactionId: charge.transactionId,
      placeholderPayment: vault.placeholder,
    };
  }
  const f = (fin ?? {}) as Record<string, string | undefined>;

  // 6) Portal invite (non-fatal; ALREADY_LINKED is a benign idempotent outcome).
  let portalInvited = false;
  try {
    const r = await onboardMemberLogin(service, {
      memberId: input.memberId,
      organizationId: input.organizationId,
      email: input.email,
      fullName,
      mode: 'invite',
      redirectTo: input.portalRedirectTo,
    });
    portalInvited = r.ok || r.code === 'ALREADY_LINKED';
  } catch (e) {
    console.error('[finalizeEnrollment] portal invite failed (non-fatal)', e);
  }

  // 7) Confirmation emails — member + agent (non-fatal).
  let memberEmailSent = false;
  try {
    const res = await sendEnrollmentConfirmationEmail({
      toEmail: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone ?? '',
      planName: input.planName,
      enrollmentId: input.enrollmentId,
      organizationName: input.organizationName,
    });
    memberEmailSent = res.success;
  } catch (e) {
    console.error('[finalizeEnrollment] member email failed (non-fatal)', e);
  }

  let agentEmailSent = false;
  try {
    const { data: enr } = await sb
      .from('enrollments')
      .select('advisor_id')
      .eq('id', input.enrollmentId)
      .maybeSingle();
    let advisorId: string | null = enr?.advisor_id ?? null;
    if (!advisorId) {
      const { data: org } = await sb
        .from('organizations')
        .select('settings')
        .eq('id', input.organizationId)
        .maybeSingle();
      advisorId = (org?.settings?.default_org_agent_id as string | undefined) ?? null;
    }
    if (advisorId) {
      const { data: agent } = await sb
        .from('advisors')
        .select('email, first_name, last_name')
        .eq('id', advisorId)
        .eq('organization_id', input.organizationId)
        .maybeSingle();
      if (agent?.email) {
        const ar = await sendAdvisorNotificationEmail({
          advisorEmail: agent.email,
          advisorName: `${agent.first_name ?? ''} ${agent.last_name ?? ''}`.trim() || 'Advisor',
          memberFirstName: input.firstName,
          memberLastName: input.lastName,
          memberEmail: input.email,
          memberPhone: input.phone ?? '',
          enrollmentId: input.enrollmentId,
          organizationName: input.organizationName,
        });
        agentEmailSent = ar.success;
      }
    }
  } catch (e) {
    console.error('[finalizeEnrollment] agent email failed (non-fatal)', e);
  }

  return {
    success: true,
    stage: 'done',
    paymentProfileId,
    transactionId: charge.transactionId,
    membershipId: f.membership_id,
    billingScheduleId: f.billing_schedule_id,
    effectiveDate: f.effective_date,
    nextBillingDate: f.next_billing_date,
    portalInvited,
    memberEmailSent,
    agentEmailSent,
    placeholderPayment: vault.placeholder,
  };
}
