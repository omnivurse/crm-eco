'use server';

import { createServerSupabaseClient, createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { requireActiveMembership } from '@/lib/auth/require-active-membership';
import { getMemberForUser, getRxPricingEstimate, validateMedications } from '@crm-eco/lib';
import type { MedicationInput, RxPricingResult } from '@crm-eco/lib';
import {
  evaluateEligibility,
  type EligibilityInput,
  type EligibilityResult,
  type EligibilityRuleRow,
} from '@crm-eco/lib';
import { quote, buildRateConfigFromDb } from '@crm-eco/rates';
import type { QuoteInput, QuoteResult } from '@crm-eco/rates';
import { revalidatePath } from 'next/cache';

// ============================================================================
// Types
// ============================================================================

interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

interface IntakeData {
  email: string;
  phone?: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  zip_code: string;
}

interface HouseholdMember {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  relationship: 'spouse' | 'child' | 'dependent';
  ssn_last4?: string;
}

interface PlanSelectionData {
  selected_plan_id: string;
  requested_effective_date: string;
  rx_medications?: MedicationInput[];
}

interface ComplianceData {
  acknowledged_not_insurance: boolean;
  acknowledged_sharing_guidelines: boolean;
  acknowledged_pre_existing_conditions: boolean;
  electronic_signature: string;
}

interface PaymentData {
  payment_method: 'bank_draft' | 'credit_card';
  billing_day: number;
  payment_token?: string; // From payment processor
}

// ============================================================================
// Helper Functions
// ============================================================================

async function getOrCreateEnrollment(enrollmentId?: string) {
  // Authenticate via the SSR/cookie client (RLS-bound) — reads only the caller's
  // own auth + profile, so RLS is the right gate here.
  const ssr = await createServerSupabaseClient();
  const { data: { user } } = await ssr.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  // Resolve the caller's profile. Every authenticated user has exactly one
  // (handle_new_user). profile.id is the OWNERSHIP ANCHOR — enrollments.created_by
  // FKs to profiles.id — and profile.organization_id scopes the draft to the org.
  const { data: profile } = await ssr
    .from('profiles')
    .select('id, organization_id, member_id')
    .eq('user_id', user.id)
    .single();

  if (!profile) {
    return { error: 'Not authenticated' };
  }

  // Member context (may be null for a logged-in non-member) — used for prefill.
  const context = await getMemberForUser(ssr, user.id);

  // WRITES use the service-role client. enrollments / enrollment_steps have NO
  // member-level INSERT/UPDATE RLS policy, so the cookie/RLS client is denied for
  // a member. This mirrors the established pattern (completeSelfServeQuestionnaireStep,
  // respondMoreInfo, the submit route): service-role for the write, ownership
  // verified IN CODE. Because service-role bypasses RLS, the checks below ARE the
  // access boundary — they must be fail-closed.
  const service = createServiceRoleClient();

  // If resuming an existing enrollment
  if (enrollmentId) {
    const { data: enrollment, error } = await (service as any)
      .from('enrollments')
      .select('*, primary_member:primary_member_id(*)')
      .eq('id', enrollmentId)
      .single();

    if (error || !enrollment) {
      return { error: 'Enrollment not found' };
    }

    // FAIL-CLOSED ownership: the caller must own this enrollment — either they
    // created it (created_by is server-set to their profile id) or they are its
    // primary member. Both are airtight, non-spoofable proofs, so the org is NOT
    // re-checked here: a created_by/member match already implies rightful access,
    // and re-checking org would falsely lock out a legitimate creator whose profile
    // org is null or has since changed. A logged-in user must never reach another
    // user's enrollment through the service-role client — this is that boundary.
    const ownsAsCreator = enrollment.created_by === profile.id;
    const ownsAsMember =
      !!context?.member && enrollment.primary_member_id === context.member.id;
    if (!ownsAsCreator && !ownsAsMember) {
      return { error: 'Access denied' };
    }

    return { supabase: service, user, profile, context, enrollment };
  }

  return { supabase: service, user, profile, context, enrollment: null };
}

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Create a new self-serve enrollment
 */
export async function createSelfServeEnrollment(): Promise<ActionResult<{ enrollmentId: string }>> {
  try {
    const result = await getOrCreateEnrollment();
    if ('error' in result) {
      return { success: false, error: result.error };
    }

    const { supabase, profile, context } = result;

    // Self-serve enrollment is member-only: enrollments.primary_member_id is NOT
    // NULL, so only an existing member can be the primary applicant on this
    // logged-in path. Fail with a clear message instead of a raw DB NOT-NULL error.
    // (Brand-new prospects enroll via the public/anon route, not these actions.)
    if (!context?.member) {
      return {
        success: false,
        error: 'An active membership is required to start an enrollment.',
      };
    }

    // Generate enrollment number
    const enrollmentNumber = `WS-SS-${Date.now().toString(36).toUpperCase()}`;

    // Prepare enrollment data
    const enrollmentData: Record<string, unknown> = {
      enrollment_number: enrollmentNumber,
      enrollment_mode: 'member_self_serve',
      enrollment_source: 'portal',
      status: 'draft',
      snapshot: {
        intake: context?.member ? {
          email: context.member.email,
          phone: context.member.phone,
          address_line1: context.member.address_line1,
          address_line2: context.member.address_line2,
          city: context.member.city,
          state: context.member.state,
          zip_code: context.member.postal_code,
        } : {},
        household: { members: [] },
        plan_selection: {},
        compliance: {},
        payment: {},
      },
      rx_medications: [],
      rx_pricing_result: {},
    };

    // Owner + org. created_by (-> profiles.id) is the ownership anchor verified on
    // every resume/step/submit. Org comes from the caller's profile, then their
    // member, then the first available org as a last resort.
    enrollmentData.created_by = profile.id;
    if (context?.member) {
      enrollmentData.primary_member_id = context.member.id;
    }
    enrollmentData.organization_id =
      profile.organization_id ?? context?.member?.organization_id ?? null;
    if (!enrollmentData.organization_id) {
      const { data: org } = await (supabase as any)
        .from('organizations')
        .select('id')
        .limit(1)
        .single();
      if (org) {
        enrollmentData.organization_id = org.id;
      }
    }

    // Create enrollment
    const { data: enrollment, error } = await (supabase as any)
      .from('enrollments')
      .insert(enrollmentData)
      .select()
      .single();

    if (error) {
      return { success: false, error: 'Failed to create enrollment' };
    }

    // Log audit event
    await (supabase as any)
      .from('enrollment_audit_log')
      .insert({
        enrollment_id: enrollment.id,
        event_type: 'status_change',
        actor_profile_id: profile.id,
        message: 'Self-serve enrollment started',
        data_after: { status: 'draft', mode: 'member_self_serve' },
      });

    revalidatePath('/enroll');

    return { success: true, data: { enrollmentId: enrollment.id } };
  } catch (error) {
    console.error('createSelfServeEnrollment error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Complete the Intake step
 */
export async function completeSelfServeIntakeStep(
  enrollmentId: string,
  data: IntakeData
): Promise<ActionResult> {
  try {
    const result = await getOrCreateEnrollment(enrollmentId);
    if ('error' in result) {
      return { success: false, error: result.error };
    }

    const { supabase, user, enrollment } = result;

    // Update enrollment snapshot
    const snapshot = enrollment.snapshot || {};
    snapshot.intake = {
      ...snapshot.intake,
      ...data,
    };

    // Update enrollment
    const { error } = await (supabase as any)
      .from('enrollments')
      .update({
        snapshot,
        status: enrollment.status === 'draft' ? 'in_progress' : enrollment.status,
      })
      .eq('id', enrollmentId);

    if (error) {
      return { success: false, error: 'Failed to save intake data' };
    }

    // Record step completion
    await (supabase as any)
      .from('enrollment_steps')
      .upsert({
        organization_id: enrollment.organization_id,
        enrollment_id: enrollmentId,
        step_key: 'intake',
        is_completed: true,
        completed_at: new Date().toISOString(),
        payload: data,
      }, {
        onConflict: 'enrollment_id,step_key',
      });

    // Audit log
    await (supabase as any)
      .from('enrollment_audit_log')
      .insert({
        enrollment_id: enrollmentId,
        event_type: 'step_completed',
        actor_profile_id: user.id,
        message: 'Intake step completed',
        data_after: { step: 'intake' },
      });

    revalidatePath('/enroll');

    return { success: true };
  } catch (error) {
    console.error('completeSelfServeIntakeStep error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Complete the Household step
 */
export async function completeSelfServeHouseholdStep(
  enrollmentId: string,
  members: HouseholdMember[]
): Promise<ActionResult> {
  try {
    const result = await getOrCreateEnrollment(enrollmentId);
    if ('error' in result) {
      return { success: false, error: result.error };
    }

    const { supabase, user, enrollment } = result;

    // Update snapshot
    const snapshot = enrollment.snapshot || {};
    snapshot.household = { members };

    const { error } = await (supabase as any)
      .from('enrollments')
      .update({ snapshot })
      .eq('id', enrollmentId);

    if (error) {
      return { success: false, error: 'Failed to save household data' };
    }

    // Record step completion
    await (supabase as any)
      .from('enrollment_steps')
      .upsert({
        organization_id: enrollment.organization_id,
        enrollment_id: enrollmentId,
        step_key: 'household',
        is_completed: true,
        completed_at: new Date().toISOString(),
        payload: { members },
      }, {
        onConflict: 'enrollment_id,step_key',
      });

    // Audit log
    await (supabase as any)
      .from('enrollment_audit_log')
      .insert({
        enrollment_id: enrollmentId,
        event_type: 'step_completed',
        actor_profile_id: user.id,
        message: `Household step completed with ${members.length} additional member(s)`,
        data_after: { step: 'household', memberCount: members.length },
      });

    revalidatePath('/enroll');

    return { success: true };
  } catch (error) {
    console.error('completeSelfServeHouseholdStep error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Complete the Plan Selection step
 */
export async function completeSelfServePlanSelectionStep(
  enrollmentId: string,
  data: PlanSelectionData
): Promise<ActionResult> {
  try {
    const result = await getOrCreateEnrollment(enrollmentId);
    if ('error' in result) {
      return { success: false, error: result.error };
    }

    const { supabase, user, enrollment } = result;

    // Update snapshot
    const snapshot = enrollment.snapshot || {};
    snapshot.plan_selection = {
      selected_plan_id: data.selected_plan_id,
      requested_effective_date: data.requested_effective_date,
    };

    // Prepare update
    const updateData: Record<string, unknown> = {
      snapshot,
      selected_plan_id: data.selected_plan_id,
      requested_effective_date: data.requested_effective_date,
    };

    // Include medications if provided
    if (data.rx_medications && data.rx_medications.length > 0) {
      updateData.rx_medications = data.rx_medications;
    }

    const { error } = await (supabase as any)
      .from('enrollments')
      .update(updateData)
      .eq('id', enrollmentId);

    if (error) {
      return { success: false, error: 'Failed to save plan selection' };
    }

    // Record step completion
    await (supabase as any)
      .from('enrollment_steps')
      .upsert({
        organization_id: enrollment.organization_id,
        enrollment_id: enrollmentId,
        step_key: 'plan_selection',
        is_completed: true,
        completed_at: new Date().toISOString(),
        payload: {
          plan_id: data.selected_plan_id,
          effective_date: data.requested_effective_date,
        },
      }, {
        onConflict: 'enrollment_id,step_key',
      });

    // Audit log
    await (supabase as any)
      .from('enrollment_audit_log')
      .insert({
        enrollment_id: enrollmentId,
        event_type: 'step_completed',
        actor_profile_id: user.id,
        message: 'Plan selection completed',
        data_after: { step: 'plan_selection', plan_id: data.selected_plan_id },
      });

    revalidatePath('/enroll');

    return { success: true };
  } catch (error) {
    console.error('completeSelfServePlanSelectionStep error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Compute an authoritative, server-side quote for a draft self-serve enrollment.
 *
 * The server is the pricing authority: the client only ever assembles the
 * household `input` (ages / coverage tier / coverage start) and displays the
 * returned QuoteResult. The plan code is resolved exclusively from the
 * plan_rate_sets→plans join scoped to the enrollment's org, so a client cannot
 * spoof a different plan's pricing.
 *
 * MONEY-SAFETY: writing enrollments.base_monthly_cost fires
 * trg_enrollment_sync_billing_cost. This action only ever targets a draft /
 * in-progress enrollment (no active billing_schedule → trigger is a no-op) and
 * the write is additionally gated behind RATE_ENGINE_WRITE_ENABLED (default
 * OFF). When the flag is off, the quote is computed and returned but nothing is
 * persisted.
 */
export async function getSelfServeQuote(
  enrollmentId: string,
  selectedPlanId: string,
  input: QuoteInput
): Promise<ActionResult<QuoteResult>> {
  try {
    const result = await getOrCreateEnrollment(enrollmentId);
    if ('error' in result) {
      return { success: false, error: result.error };
    }

    const { supabase, user, context, enrollment } = result;

    // Require a member context — do not widen the no-member ownership hole that
    // getOrCreateEnrollment allows on the create path.
    if (!context?.member) {
      return { success: false, error: 'Access denied' };
    }

    const organizationId = enrollment.organization_id ?? context.member.organization_id;

    // Load the rate set(s) for the selected plan, joined with the plan,
    // its rate entries, and its fees — scoped to the enrollment's org.
    const { data: rateSets, error: rateSetsError } = await (supabase as any)
      .from('plan_rate_sets')
      .select(`
        *,
        plan:plans!inner(id, name, code, organization_id),
        entries:plan_rate_entries(*),
        fees:plan_fees(*)
      `)
      .eq('plan_id', selectedPlanId)
      .eq('plan.organization_id', organizationId);

    if (rateSetsError) {
      console.error('getSelfServeQuote rate set fetch error:', rateSetsError);
      return { success: false, error: 'Failed to load plan rates' };
    }

    // Resolve the plan code ONLY from the joined rate-set rows. No separate
    // plans lookup — if there's no rate set for this plan in this org, we can't
    // quote it.
    const planCode = (rateSets ?? [])
      .map((row: { plan?: { code?: string | null } }) => row.plan?.code)
      .find((code: string | null | undefined): code is string => Boolean(code));

    if (!rateSets || rateSets.length === 0 || !planCode) {
      return { success: false, error: 'NO_RATE_SET' };
    }

    // Build the engine config from the DB rows and compute the quote.
    // Force the plan code from the trusted server-side join so the client
    // cannot point the quote at a different plan.
    const config = buildRateConfigFromDb(rateSets);
    const quoteResult = quote(config, { ...input, planId: planCode });

    // MONEY-SAFE persistence: flag-gated (default OFF) and only on draft /
    // in-progress enrollments where the billing-sync trigger is a no-op.
    if (process.env.RATE_ENGINE_WRITE_ENABLED === 'true') {
      const snapshot = enrollment.snapshot || {};
      snapshot.quote = quoteResult;

      const { error: updateError } = await (supabase as any)
        .from('enrollments')
        .update({
          base_monthly_cost: quoteResult.monthlyPremium,
          total_monthly_cost: quoteResult.totalMonthly,
          snapshot,
        })
        .eq('id', enrollmentId)
        // Money-safety (defense-in-depth): only ever stamp the quote onto a
        // pre-active draft so the base_monthly_cost AFTER-UPDATE billing trigger
        // (trg_enrollment_sync_billing_cost) can NEVER fire on an active enrollment.
        // The trigger is also a no-op off-'active', but this makes the invariant
        // explicit rather than relying on the caller only quoting drafts.
        .in('status', ['draft', 'in_progress']);

      if (updateError) {
        return { success: false, error: 'Failed to save quote' };
      }

      // Audit log — non-fatal so a logging failure never blocks the quote.
      try {
        await (supabase as any)
          .from('enrollment_audit_log')
          .insert({
            organization_id: organizationId,
            enrollment_id: enrollmentId,
            event_type: 'note',
            actor_profile_id: user.id,
            message: 'Quote computed and persisted',
            data_after: {
              plan_id: selectedPlanId,
              plan_code: planCode,
              monthly_premium: quoteResult.monthlyPremium,
              total_monthly: quoteResult.totalMonthly,
            },
          });
      } catch (auditError) {
        console.error('getSelfServeQuote audit log error:', auditError);
      }
    }

    return { success: true, data: quoteResult };
  } catch (error) {
    console.error('getSelfServeQuote error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/** Whole-year age as of a reference date, from a YYYY-MM-DD (or ISO) DOB string. */
function ageOnDate(dob: string | null | undefined, asOf: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  const ref = new Date(asOf);
  if (Number.isNaN(d.getTime()) || Number.isNaN(ref.getTime())) return null;
  let age = ref.getFullYear() - d.getFullYear();
  const m = ref.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < d.getDate())) age--;
  return age >= 0 && age < 120 ? age : null;
}

/**
 * Evaluate DB-driven eligibility rules for the selected plan, server-side.
 *
 * Activates `product_eligibility_rules` (previously inert) at enroll time. The
 * server is the authority: the client only assembles a (plan, effective-date)
 * pair; the action reads the member/household from the persisted enrollment
 * snapshot, derives ages-from-DOB + state + household size, fetches the rules
 * scoped to the enrollment's org, and returns a STRUCTURED EligibilityResult.
 *
 * The plan's rules are read ONLY for a plan in the enrollment's org (the rules
 * FK to plans, and product_eligibility_rules RLS is org-scoped via
 * plans.organization_id) — a client cannot point eligibility at another org's
 * plan because the rule rows are filtered to the org-owned plan id.
 *
 * SAFETY: read-only, never mutates enrollment state. block-vs-warn is decided
 * by the CALLER (the plan-selection step) using ELIGIBILITY_ENFORCE; this
 * action just reports each finding's natural severity. Mirrors getSelfServeQuote.
 */
export async function getSelfServeEligibility(
  enrollmentId: string,
  selectedPlanId: string,
  requestedEffectiveDate: string,
): Promise<ActionResult<EligibilityResult>> {
  try {
    const result = await getOrCreateEnrollment(enrollmentId);
    if ('error' in result) {
      return { success: false, error: result.error };
    }

    const { supabase, context, enrollment } = result;

    // Require a member context — same ownership posture as getSelfServeQuote.
    if (!context?.member) {
      return { success: false, error: 'Access denied' };
    }

    const organizationId = enrollment.organization_id ?? context.member.organization_id;

    // Confirm the plan belongs to the enrollment's org BEFORE reading rules, so
    // a spoofed plan id from another org can't surface that org's rules.
    const { data: plan } = await (supabase as any)
      .from('plans')
      .select('id')
      .eq('id', selectedPlanId)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (!plan) {
      // Unknown / cross-org plan: no rules apply (eligible). Don't error — this
      // is an advisory surface and must never block the wizard.
      return { success: true, data: { isEligible: true, blocking: [], advisory: [], findings: [] } };
    }

    // Read active rules for the (org-owned) plan.
    const { data: ruleRows, error: rulesError } = await (supabase as any)
      .from('product_eligibility_rules')
      .select('id, rule_type, rule_name, config, is_blocking, error_message, sort_order, is_active')
      .eq('plan_id', selectedPlanId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (rulesError) {
      // A read error must never block the wizard — degrade to eligible.
      return { success: true, data: { isEligible: true, blocking: [], advisory: [], findings: [] } };
    }

    if (!ruleRows || ruleRows.length === 0) {
      return { success: true, data: { isEligible: true, blocking: [], advisory: [], findings: [] } };
    }

    // Assemble the evaluator input from the persisted snapshot (the same source
    // of truth the rate adapter uses): ages-from-DOB, state, household size.
    const snapshot = enrollment.snapshot || {};
    const coverageStart = requestedEffectiveDate || enrollment.requested_effective_date || null;
    const intake = snapshot.intake || {};
    const householdMembers: Array<{ relationship?: string }> =
      snapshot.household?.members ?? [];

    const dob = intake.date_of_birth ?? context.member.date_of_birth ?? null;
    const memberAge = coverageStart ? ageOnDate(dob, coverageStart) : ageOnDate(dob, new Date().toISOString());
    const state = intake.state ?? context.member.state ?? null;

    const input: EligibilityInput = {
      memberAge,
      state,
      householdSize: 1 + householdMembers.length,
      coverageStart,
    };

    const evaluation = evaluateEligibility(ruleRows as EligibilityRuleRow[], input);

    return { success: true, data: evaluation };
  } catch (error) {
    console.error('getSelfServeEligibility error:', error);
    // Never block the wizard on an unexpected error — report eligible.
    return { success: true, data: { isEligible: true, blocking: [], advisory: [], findings: [] } };
  }
}

/**
 * Run Rx pricing for medications
 */
export async function runSelfServeRxPricing(
  enrollmentId: string,
  medications: MedicationInput[]
): Promise<ActionResult<RxPricingResult>> {
  try {
    const result = await getOrCreateEnrollment(enrollmentId);
    if ('error' in result) {
      return { success: false, error: result.error };
    }

    const { supabase, user, enrollment } = result;

    // Validate medications
    const validationError = validateMedications(medications);
    if (validationError) {
      return { success: false, error: validationError };
    }

    // Get member state from snapshot
    const memberState = enrollment.snapshot?.intake?.state;
    const planId = enrollment.selected_plan_id;

    // Get Rx pricing
    const pricingResult = await getRxPricingEstimate({
      meds: medications,
      memberState,
      planId,
    });

    // Update enrollment with medications and pricing
    const { error } = await (supabase as any)
      .from('enrollments')
      .update({
        rx_medications: medications,
        rx_pricing_result: pricingResult,
      })
      .eq('id', enrollmentId);

    if (error) {
      return { success: false, error: 'Failed to save Rx pricing' };
    }

    // Audit log
    await (supabase as any)
      .from('enrollment_audit_log')
      .insert({
        enrollment_id: enrollmentId,
        event_type: 'note',
        actor_profile_id: user.id,
        message: `Rx pricing estimated for ${medications.length} medication(s)`,
        data_after: { medications_count: medications.length },
      });

    revalidatePath('/enroll');

    return { success: true, data: pricingResult };
  } catch (error) {
    console.error('runSelfServeRxPricing error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Complete the Compliance step
 */
export async function completeSelfServeComplianceStep(
  enrollmentId: string,
  data: ComplianceData
): Promise<ActionResult> {
  try {
    const result = await getOrCreateEnrollment(enrollmentId);
    if ('error' in result) {
      return { success: false, error: result.error };
    }

    const { supabase, user, enrollment } = result;

    // Validate all acknowledgments
    if (!data.acknowledged_not_insurance ||
        !data.acknowledged_sharing_guidelines ||
        !data.acknowledged_pre_existing_conditions ||
        !data.electronic_signature?.trim()) {
      return { success: false, error: 'All acknowledgments and signature are required' };
    }

    // Update snapshot
    const snapshot = enrollment.snapshot || {};
    snapshot.compliance = {
      ...data,
      signed_at: new Date().toISOString(),
    };

    const { error } = await (supabase as any)
      .from('enrollments')
      .update({ snapshot })
      .eq('id', enrollmentId);

    if (error) {
      return { success: false, error: 'Failed to save compliance data' };
    }

    // Record step completion
    await (supabase as any)
      .from('enrollment_steps')
      .upsert({
        organization_id: enrollment.organization_id,
        enrollment_id: enrollmentId,
        step_key: 'compliance',
        is_completed: true,
        completed_at: new Date().toISOString(),
        payload: { signed_at: new Date().toISOString() },
      }, {
        onConflict: 'enrollment_id,step_key',
      });

    // Audit log
    await (supabase as any)
      .from('enrollment_audit_log')
      .insert({
        enrollment_id: enrollmentId,
        event_type: 'step_completed',
        actor_profile_id: user.id,
        message: 'Compliance acknowledgments signed',
        data_after: { step: 'compliance' },
      });

    revalidatePath('/enroll');

    return { success: true };
  } catch (error) {
    console.error('completeSelfServeComplianceStep error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Complete the DB-driven Questionnaire step.
 *
 * Mirrors completeSelfServeComplianceStep, with one difference: the NORMALIZED
 * response is the source of truth and is written with the SERVICE-ROLE client
 * (the questionnaire_responses / questionnaire_answers tables and their member
 * write RLS are Phase 2 — until that lands, the self-serve write path goes
 * through the service role, NOT member RLS). The snapshot.questionnaire slot is
 * only a DERIVED mirror for fast wizard re-hydration, written with the normal
 * request-scoped client like every other step.
 *
 * SAFETY / INERT MVP: the wizard never calls this until a questionnaire template
 * is wired (no template -> the step renders nothing and completeQuestionnaireStep
 * is never invoked). And because the normalized tables are not materialized yet,
 * the normalized write is best-effort: a missing-table error is logged and does
 * NOT block the snapshot/step persistence or corrupt enrollment state. This keeps
 * the action a safe no-op-equivalent if it is ever invoked before Phase 2.
 */
export async function completeSelfServeQuestionnaireStep(
  enrollmentId: string,
  templateId: string,
  answers: Record<string, unknown>
): Promise<ActionResult> {
  try {
    const result = await getOrCreateEnrollment(enrollmentId);
    if ('error' in result) {
      return { success: false, error: result.error };
    }

    const { supabase, user, enrollment } = result;

    if (!templateId) {
      return { success: false, error: 'Missing questionnaire template' };
    }

    const completedAt = new Date().toISOString();

    // ----------------------------------------------------------------------
    // 1) NORMALIZED persistence (source of truth) — service-role, best-effort.
    //    Header row in questionnaire_responses, one row per answer in
    //    questionnaire_answers. Wrapped so a missing-table / RLS error never
    //    blocks the wizard before the Phase 2 questionnaire engine ships.
    // ----------------------------------------------------------------------
    let responseId: string | undefined;
    try {
      const service = createServiceRoleClient();
      const organizationId = enrollment.organization_id ?? null;

      // Header row. Columns mirror the drafted questionnaire_responses schema
      // (supabase/drafts/202606240002_questionnaire_engine.sql): organization_id
      // is NOT NULL, status drives the response lifecycle, submitted_at stamps
      // completion. (No member_id / completed_at columns exist on that table.)
      const { data: response, error: responseError } = await (service as any)
        .from('questionnaire_responses')
        .insert({
          enrollment_id: enrollmentId,
          template_id: templateId,
          organization_id: organizationId,
          status: 'submitted',
          submitted_at: completedAt,
        })
        .select('id')
        .single();

      if (responseError) {
        throw responseError;
      }

      responseId = response?.id;

      // Resolve question_id from (template_id, key): questionnaire_answers.question_id
      // is NOT NULL with ON DELETE RESTRICT, so an answer must reference a real
      // question row. Only questions that still exist on the template are persisted
      // as normalized rows (the snapshot mirror below retains the full answer set).
      const answerKeys = Object.keys(answers);
      if (responseId && answerKeys.length > 0) {
        const { data: questionRows, error: questionsError } = await (service as any)
          .from('questionnaire_questions')
          .select('id, key')
          .eq('template_id', templateId)
          .in('key', answerKeys);
        if (questionsError) {
          throw questionsError;
        }

        const idByKey = new Map<string, string>(
          (questionRows ?? []).map((q: { id: string; key: string }) => [q.key, q.id]),
        );

        const answerRows = answerKeys
          .filter((key) => idByKey.has(key))
          .map((key) => ({
            response_id: responseId,
            organization_id: organizationId,
            question_id: idByKey.get(key),
            question_key: key,
            value: answers[key] ?? null,
          }));

        if (answerRows.length > 0) {
          const { error: answersError } = await (service as any)
            .from('questionnaire_answers')
            .insert(answerRows);
          if (answersError) {
            throw answersError;
          }
        }
      }
    } catch (normalizedError) {
      // Non-fatal: the normalized tables may not exist yet (Phase 2). The
      // derived snapshot mirror below still records the answers so the wizard
      // can advance. Surface for diagnostics.
      console.error('completeSelfServeQuestionnaireStep normalized persist skipped:', normalizedError);
    }

    // ----------------------------------------------------------------------
    // 2) DERIVED snapshot mirror — request-scoped client, like every step.
    // ----------------------------------------------------------------------
    const snapshot = enrollment.snapshot || {};
    snapshot.questionnaire = {
      template_id: templateId,
      ...(responseId ? { response_id: responseId } : {}),
      answers,
      completed_at: completedAt,
    };

    const { error } = await (supabase as any)
      .from('enrollments')
      .update({ snapshot })
      .eq('id', enrollmentId);

    if (error) {
      return { success: false, error: 'Failed to save questionnaire data' };
    }

    // Record step completion
    await (supabase as any)
      .from('enrollment_steps')
      .upsert({
        organization_id: enrollment.organization_id,
        enrollment_id: enrollmentId,
        step_key: 'questionnaire',
        is_completed: true,
        completed_at: completedAt,
        payload: { template_id: templateId, answer_count: Object.keys(answers).length },
      }, {
        onConflict: 'enrollment_id,step_key',
      });

    // Audit log
    await (supabase as any)
      .from('enrollment_audit_log')
      .insert({
        enrollment_id: enrollmentId,
        event_type: 'step_completed',
        actor_profile_id: user.id,
        message: 'Questionnaire completed',
        data_after: { step: 'questionnaire', template_id: templateId },
      });

    revalidatePath('/enroll');

    return { success: true };
  } catch (error) {
    console.error('completeSelfServeQuestionnaireStep error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Complete the Payment step
 */
export async function completeSelfServePaymentStep(
  enrollmentId: string,
  data: PaymentData
): Promise<ActionResult> {
  try {
    const result = await getOrCreateEnrollment(enrollmentId);
    if ('error' in result) {
      return { success: false, error: result.error };
    }

    const { supabase, user, enrollment } = result;

    // Update snapshot
    const snapshot = enrollment.snapshot || {};
    snapshot.payment = {
      payment_method: data.payment_method,
      billing_day: data.billing_day,
      // Don't store actual payment details in snapshot
    };

    const { error } = await (supabase as any)
      .from('enrollments')
      .update({ snapshot })
      .eq('id', enrollmentId);

    if (error) {
      return { success: false, error: 'Failed to save payment data' };
    }

    // Record step completion
    await (supabase as any)
      .from('enrollment_steps')
      .upsert({
        organization_id: enrollment.organization_id,
        enrollment_id: enrollmentId,
        step_key: 'payment',
        is_completed: true,
        completed_at: new Date().toISOString(),
        payload: { payment_method: data.payment_method },
      }, {
        onConflict: 'enrollment_id,step_key',
      });

    // Audit log
    await (supabase as any)
      .from('enrollment_audit_log')
      .insert({
        enrollment_id: enrollmentId,
        event_type: 'step_completed',
        actor_profile_id: user.id,
        message: 'Payment information collected',
        data_after: { step: 'payment', method: data.payment_method },
      });

    revalidatePath('/enroll');

    return { success: true };
  } catch (error) {
    console.error('completeSelfServePaymentStep error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Submit the enrollment for review
 */
export async function submitSelfServeEnrollment(
  enrollmentId: string
): Promise<ActionResult<{ membershipId?: string }>> {
  try {
    const result = await getOrCreateEnrollment(enrollmentId);
    if ('error' in result) {
      return { success: false, error: result.error };
    }

    const { supabase, user, enrollment } = result;

    // Verify all steps are complete (column is `is_completed boolean` in DB)
    const { data: steps } = await (supabase as any)
      .from('enrollment_steps')
      .select('step_key, is_completed')
      .eq('enrollment_id', enrollmentId);

    const requiredSteps = ['intake', 'household', 'plan_selection', 'compliance', 'payment'];
    const completedSteps = new Set(
      (steps || [])
        .filter((s: { is_completed: boolean }) => s.is_completed === true)
        .map((s: { step_key: string }) => s.step_key)
    );

    const missingSteps = requiredSteps.filter(s => !completedSteps.has(s));
    if (missingSteps.length > 0) {
      return { 
        success: false, 
        error: `Please complete all steps: ${missingSteps.join(', ')}` 
      };
    }

    // Update enrollment status
    const { error: updateError } = await (supabase as any)
      .from('enrollments')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      })
      .eq('id', enrollmentId);

    if (updateError) {
      return { success: false, error: 'Failed to submit enrollment' };
    }

    // For self-serve, create membership with 'pending' status (requires approval)
    let membershipId: string | undefined;

    if (enrollment.primary_member_id && enrollment.selected_plan_id) {
      const { data: membership, error: membershipError } = await (supabase as any)
        .from('memberships')
        .insert({
          member_id: enrollment.primary_member_id,
          plan_id: enrollment.selected_plan_id,
          organization_id: enrollment.organization_id,
          enrollment_id: enrollmentId,
          advisor_id: enrollment.advisor_id || null,
          status: 'pending', // Self-serve requires approval
          effective_date: enrollment.requested_effective_date,
        })
        .select()
        .single();

      if (!membershipError && membership) {
        membershipId = membership.id;
      }
    }

    // Record step completion
    await (supabase as any)
      .from('enrollment_steps')
      .upsert({
        organization_id: enrollment.organization_id,
        enrollment_id: enrollmentId,
        step_key: 'confirmation',
        is_completed: true,
        completed_at: new Date().toISOString(),
        payload: { submitted: true },
      }, {
        onConflict: 'enrollment_id,step_key',
      });

    // Audit log
    await (supabase as any)
      .from('enrollment_audit_log')
      .insert({
        enrollment_id: enrollmentId,
        event_type: 'status_change',
        actor_profile_id: user.id,
        message: 'Enrollment submitted for review',
        data_before: { status: enrollment.status },
        data_after: { status: 'submitted', membership_id: membershipId },
      });

    revalidatePath('/enroll');
    revalidatePath('/');

    return { success: true, data: { membershipId } };
  } catch (error) {
    console.error('submitSelfServeEnrollment error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Get enrollment data for resuming
 */
export async function getEnrollmentData(enrollmentId: string): Promise<ActionResult<{
  enrollment: Record<string, unknown>;
  steps: Array<{ step_key: string; status: string; data: unknown }>;
  plans: Array<{ id: string; name: string; code: string; monthly_share: number }>;
}>> {
  try {
    const result = await getOrCreateEnrollment(enrollmentId);
    if ('error' in result) {
      return { success: false, error: result.error };
    }

    const { supabase, enrollment } = result;

    // Get step status (returns DB columns; UI consumers map to its own shape)
    const { data: rawSteps } = await (supabase as any)
      .from('enrollment_steps')
      .select('step_key, is_completed, payload')
      .eq('enrollment_id', enrollmentId);

    // Adapt to the API shape that callers expect (status + data).
    const steps = (rawSteps ?? []).map((s: { step_key: string; is_completed: boolean; payload: unknown }) => ({
      step_key: s.step_key,
      status: s.is_completed ? 'completed' : 'pending',
      data: s.payload,
    }));

    // Get available plans
    const { data: plans } = await (supabase as any)
      .from('plans')
      .select('id, name, code, monthly_share, description')
      .eq('organization_id', enrollment.organization_id)
      .eq('is_active', true)
      .order('monthly_share');

    return {
      success: true,
      data: {
        enrollment,
        steps: steps || [],
        plans: plans || [],
      },
    };
  } catch (error) {
    console.error('getEnrollmentData error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Applicant response to an admin "more info" request (SLICE E5).
 * ----------------------------------------------------------------
 * The enrollee/member side of the parallel-binding decision loop (the admin side
 * is requestMoreInfo in apps/admin/.../enrollments/actions.ts; the L329 note
 * there deferred this counterpart). When an admin requests more info, the
 * enrollment is parked in status='more_info', the open enrollment_approvals row
 * is 'changes_requested', and an applicant-visible more_info_request review row
 * carries the prompt. This action lets the member reply and re-enter the queue.
 *
 * WHY service-role + verify-ownership-in-code (NOT a new RLS policy / SSR client):
 *   enrollment_reviews has NO applicant RLS policy — only admin view/manage +
 *   service_role bypass — so a member's anon/cookie client cannot INSERT an
 *   applicant_response row. Rather than widen the table's RLS (which would also
 *   expose internal review rows to applicants), we mirror the
 *   completeSelfServeQuestionnaireStep precedent: resolve + verify ownership in
 *   code, THEN write with the service-role client. enrollment_approvals is
 *   likewise a draft table written via the service role + (... as any) cast.
 *
 * ORDER OF WRITES (each guarded; nothing rolls back a committed earlier step):
 *   1. INSERT enrollment_reviews { kind:'applicant_response', visibility:
 *      'applicant', body, enrollment_id, organization_id, author_profile_id }.
 *   2. UPDATE enrollments SET status='submitted' WHERE id=... AND status=
 *      'more_info' AND primary_member_id=member.id. The WHERE-status guard means a
 *      concurrent admin change (e.g. they already moved it) yields 0 rows and we
 *      bail with 'not_awaiting_input' — we NEVER clobber an admin transition. The
 *      LIVE BEFORE trigger update_enrollment_status_change() owns submitted_at; we
 *      do not stamp it. base_monthly_cost is NEVER touched.
 *   3. RE-OPEN the parallel approval: UPDATE enrollment_approvals SET status=
 *      'pending' (+ clear resolved_/decided_ fields) WHERE enrollment_id=... AND
 *      status='changes_requested', so it re-enters the admin queue.
 *   4. INSERT enrollment_audit_log (more_info_response, more_info -> submitted).
 *   5. revalidatePath the member surfaces.
 *
 * MONEY-SAFETY: status='submitted' (NOT active/approved) does not fire billing;
 * the only billing-touching path is enrollments.base_monthly_cost, which this
 * action never writes.
 */
export async function respondMoreInfo(
  enrollmentId: string,
  body: string,
): Promise<ActionResult> {
  try {
    if (!enrollmentId) {
      return { success: false, error: 'Missing enrollment' };
    }

    const trimmed = (body ?? '').trim();
    if (!trimmed) {
      return { success: false, error: 'A response is required' };
    }

    // Auth gate — resolves { member, profile } or redirects (login/access-denied).
    const ctx = await requireActiveMembership();

    const service = createServiceRoleClient();

    // Re-verify ownership IN CODE (fail closed) before any privileged write.
    const { data: enrollment } = await (service as any)
      .from('enrollments')
      .select('id, status, primary_member_id, organization_id')
      .eq('id', enrollmentId)
      .maybeSingle();

    if (
      !enrollment ||
      enrollment.primary_member_id !== ctx.member.id ||
      enrollment.organization_id !== ctx.member.organization_id
    ) {
      return { success: false, error: 'Access denied' };
    }

    const organizationId = ctx.member.organization_id;
    const nowIso = new Date().toISOString();

    // (1) Applicant-visible response row on the review thread.
    const { error: reviewError } = await (service as any)
      .from('enrollment_reviews')
      .insert({
        enrollment_id: enrollmentId,
        organization_id: organizationId,
        kind: 'applicant_response',
        visibility: 'applicant',
        body: trimmed,
        author_profile_id: ctx.profile.id,
      });

    if (reviewError) {
      console.error('respondMoreInfo review insert error:', reviewError);
      return { success: false, error: 'Failed to save your response' };
    }

    // (2) Transition more_info -> submitted, guarded so a concurrent admin change
    //     is NOT clobbered. The BEFORE trigger stamps submitted_at; we don't.
    const { data: updatedRows, error: statusError } = await (service as any)
      .from('enrollments')
      .update({ status: 'submitted' })
      .eq('id', enrollmentId)
      .eq('status', 'more_info')
      .eq('primary_member_id', ctx.member.id)
      .select('id');

    if (statusError) {
      console.error('respondMoreInfo status update error:', statusError);
      return { success: false, error: 'Failed to submit your response' };
    }

    if (!updatedRows || updatedRows.length === 0) {
      // The enrollment was no longer awaiting input (admin moved it). The
      // applicant_response row above is still persisted as a record of the reply.
      return { success: false, error: 'not_awaiting_input' };
    }

    // (3) Re-open the parallel approval so it re-enters the admin queue. The
    //     idx_enrollment_approvals_open UNIQUE partial allows exactly one pending
    //     row per enrollment; the changes_requested row becoming pending is safe.
    //     Best-effort: a manually-triaged enrollment may have no approval row.
    try {
      await (service as any)
        .from('enrollment_approvals')
        .update({
          status: 'pending',
          resolved_by: null,
          resolved_at: null,
          decided_by: null,
          decided_at: null,
        })
        .eq('enrollment_id', enrollmentId)
        .eq('status', 'changes_requested');
    } catch (approvalError) {
      // Missing/absent approval row must not abort the response — the status
      // change is the source of truth; the approval row is the parallel mirror.
      console.error('respondMoreInfo approval reopen skipped:', approvalError);
    }

    // (4) Audit trail (additive). Free-text event_type (no CHECK on the column).
    try {
      await (service as any)
        .from('enrollment_audit_log')
        .insert({
          organization_id: organizationId,
          enrollment_id: enrollmentId,
          actor_profile_id: ctx.profile.id,
          event_type: 'more_info_response',
          old_status: 'more_info',
          new_status: 'submitted',
          message: 'Applicant responded to more-info request',
        });
    } catch (auditError) {
      // Audit log is non-fatal — never roll back the response over a log write.
      console.error('respondMoreInfo audit log error:', auditError);
    }

    // (5) Re-render the member surfaces that show this enrollment.
    revalidatePath('/enroll');
    revalidatePath(`/enrollments/${enrollmentId}`);
    revalidatePath('/');

    return { success: true };
  } catch (error) {
    console.error('respondMoreInfo error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

