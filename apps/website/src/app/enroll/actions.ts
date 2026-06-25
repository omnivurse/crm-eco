'use server';

import { createServerSupabaseClient, createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import {
  getMemberForUser,
  getRxPricingEstimate,
  validateMedications,
  buildEnrollmentApprovalRecord,
  checkEnrollmentApprovalRequired,
} from '@crm-eco/lib';
import type { MedicationInput, RxPricingResult } from '@crm-eco/lib';
import type { ActionResult, IntakeData, HouseholdMember, PlanSelectionData, ComplianceData, PaymentData } from '@crm-eco/enrollment';
import { revalidatePath } from 'next/cache';

// STATE-TOUCHING: auto-routing a freshly submitted enrollment into a review hold
// is only done when this flag is explicitly enabled. Defaults OFF — when off, the
// enrollment stays 'submitted' and admins triage it manually (the safe, unchanged
// default). When ON, enrollment-submit approval rules are evaluated and a match
// parks the enrollment in 'pending_review' for review. Mirrors the member portal's
// submit route (apps/portal/src/app/api/enroll/submit/route.ts).
const ENROLLMENT_APPROVAL_ENABLED = process.env.ENROLLMENT_APPROVAL_ENABLED === 'true';

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
  // a member. This mirrors the established pattern (apps/portal/src/app/enroll/
  // actions.ts, the submit route): service-role for the write, ownership verified
  // IN CODE. Because service-role bypasses RLS, the checks below ARE the access
  // boundary — they must be fail-closed.
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

/** Whole-year age as of a reference date, from a YYYY-MM-DD (or ISO) DOB string. */
function ageOnDate(dob: string | null | undefined, asOf: Date): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime()) || Number.isNaN(asOf.getTime())) return null;
  let age = asOf.getFullYear() - d.getFullYear();
  const m = asOf.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && asOf.getDate() < d.getDate())) age--;
  return age >= 0 && age < 120 ? age : null;
}

// ============================================================================
// Server Actions
// ============================================================================

export async function createSelfServeEnrollment(
  options?: { advisorId?: string; landingPageId?: string; enrollmentSource?: string }
): Promise<ActionResult<{ enrollmentId: string }>> {
  try {
    const result = await getOrCreateEnrollment();
    if ('error' in result) {
      return { success: false, error: result.error };
    }

    const { supabase, profile, context } = result;

    // Self-serve enrollment is member-only: enrollments.primary_member_id is NOT
    // NULL, so only an existing member can be the primary applicant on this
    // logged-in path. Fail with a clear message instead of a raw DB NOT-NULL error.
    // (Brand-new prospects enroll via the public/anon route — the landing-page
    // wizard's POST /api/enroll/submit — not these logged-in actions.)
    if (!context?.member) {
      return {
        success: false,
        error: 'An active membership is required to start an enrollment.',
      };
    }

    const enrollmentNumber = `WS-SS-${Date.now().toString(36).toUpperCase()}`;
    const source = options?.enrollmentSource || 'website';

    const enrollmentData: Record<string, unknown> = {
      enrollment_number: enrollmentNumber,
      enrollment_mode: 'member_self_serve',
      enrollment_source: source,
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
        landing_page_id: options?.landingPageId || null,
      },
      rx_medications: [],
      rx_pricing_result: {},
    };

    // Set advisor_id if provided (e.g., from a landing page) — website-specific.
    if (options?.advisorId) {
      enrollmentData.advisor_id = options.advisorId;
    }

    // Owner + member + org. created_by (-> profiles.id) is the ownership anchor
    // verified on every resume/step/submit. primary_member_id is required (checked
    // above). Org comes from the caller's profile, then their member, then the
    // first available org as a last resort.
    enrollmentData.created_by = profile.id;
    enrollmentData.primary_member_id = context.member.id;
    enrollmentData.organization_id =
      profile.organization_id ?? context.member.organization_id ?? null;
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

    // Also set the advisor on the member record if not already set (website-specific).
    if (options?.advisorId && !context.member.advisor_id) {
      await (supabase as any)
        .from('members')
        .update({ advisor_id: options.advisorId })
        .eq('id', context.member.id);
    }

    const { data: enrollment, error } = await (supabase as any)
      .from('enrollments')
      .insert(enrollmentData)
      .select()
      .single();

    if (error) {
      console.error('Failed to create enrollment:', error);
      return { success: false, error: 'Failed to create enrollment' };
    }

    await (supabase as any)
      .from('enrollment_audit_log')
      .insert({
        enrollment_id: enrollment.id,
        event_type: 'status_change',
        actor_profile_id: profile.id,
        message: `Self-serve enrollment started from ${source}`,
        data_after: {
          status: 'draft',
          mode: 'member_self_serve',
          source,
          advisor_id: options?.advisorId || null,
          landing_page_id: options?.landingPageId || null,
        },
      });

    revalidatePath('/enroll');

    return { success: true, data: { enrollmentId: enrollment.id } };
  } catch (error) {
    console.error('createSelfServeEnrollment error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

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

    const snapshot = enrollment.snapshot || {};
    snapshot.intake = { ...snapshot.intake, ...data };

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

    await (supabase as any)
      .from('enrollment_steps')
      .upsert({
        organization_id: enrollment.organization_id,
        enrollment_id: enrollmentId,
        step_key: 'intake',
        is_completed: true,
        completed_at: new Date().toISOString(),
        payload: data,
      }, { onConflict: 'enrollment_id,step_key' });

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

    const snapshot = enrollment.snapshot || {};
    snapshot.household = { members };

    const { error } = await (supabase as any)
      .from('enrollments')
      .update({ snapshot })
      .eq('id', enrollmentId);

    if (error) {
      return { success: false, error: 'Failed to save household data' };
    }

    await (supabase as any)
      .from('enrollment_steps')
      .upsert({
        organization_id: enrollment.organization_id,
        enrollment_id: enrollmentId,
        step_key: 'household',
        is_completed: true,
        completed_at: new Date().toISOString(),
        payload: { members },
      }, { onConflict: 'enrollment_id,step_key' });

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

    const snapshot = enrollment.snapshot || {};
    snapshot.plan_selection = {
      selected_plan_id: data.selected_plan_id,
      requested_effective_date: data.requested_effective_date,
    };

    const updateData: Record<string, unknown> = {
      snapshot,
      selected_plan_id: data.selected_plan_id,
      requested_effective_date: data.requested_effective_date,
    };

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

    await (supabase as any)
      .from('enrollment_steps')
      .upsert({
        organization_id: enrollment.organization_id,
        enrollment_id: enrollmentId,
        step_key: 'plan_selection',
        is_completed: true,
        completed_at: new Date().toISOString(),
        payload: { plan_id: data.selected_plan_id, effective_date: data.requested_effective_date },
      }, { onConflict: 'enrollment_id,step_key' });

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

    const validationError = validateMedications(medications);
    if (validationError) {
      return { success: false, error: validationError };
    }

    const memberState = enrollment.snapshot?.intake?.state;
    const planId = enrollment.selected_plan_id;

    const pricingResult = await getRxPricingEstimate({
      meds: medications,
      memberState,
      planId,
    });

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

    if (!data.acknowledged_not_insurance ||
        !data.acknowledged_sharing_guidelines ||
        !data.acknowledged_pre_existing_conditions ||
        !data.electronic_signature?.trim()) {
      return { success: false, error: 'All acknowledgments and signature are required' };
    }

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

    await (supabase as any)
      .from('enrollment_steps')
      .upsert({
        organization_id: enrollment.organization_id,
        enrollment_id: enrollmentId,
        step_key: 'compliance',
        is_completed: true,
        completed_at: new Date().toISOString(),
        payload: { signed_at: new Date().toISOString() },
      }, { onConflict: 'enrollment_id,step_key' });

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

    const snapshot = enrollment.snapshot || {};
    snapshot.payment = {
      payment_method: data.payment_method,
      billing_day: data.billing_day,
    };

    const { error } = await (supabase as any)
      .from('enrollments')
      .update({ snapshot })
      .eq('id', enrollmentId);

    if (error) {
      return { success: false, error: 'Failed to save payment data' };
    }

    await (supabase as any)
      .from('enrollment_steps')
      .upsert({
        organization_id: enrollment.organization_id,
        enrollment_id: enrollmentId,
        step_key: 'payment',
        is_completed: true,
        completed_at: new Date().toISOString(),
        payload: { payment_method: data.payment_method },
      }, { onConflict: 'enrollment_id,step_key' });

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

export async function submitSelfServeEnrollment(
  enrollmentId: string
): Promise<ActionResult<{ membershipId?: string }>> {
  try {
    const result = await getOrCreateEnrollment(enrollmentId);
    if ('error' in result) {
      return { success: false, error: result.error };
    }

    const { supabase, user, enrollment } = result;

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
        error: `Please complete all steps: ${missingSteps.join(', ')}`,
      };
    }

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
          status: 'pending',
          effective_date: enrollment.requested_effective_date,
        })
        .select()
        .single();

      if (!membershipError && membership) {
        membershipId = membership.id;
      }
    }

    await (supabase as any)
      .from('enrollment_steps')
      .upsert({
        organization_id: enrollment.organization_id,
        enrollment_id: enrollmentId,
        step_key: 'confirmation',
        is_completed: true,
        completed_at: new Date().toISOString(),
        payload: { submitted: true },
      }, { onConflict: 'enrollment_id,step_key' });

    await (supabase as any)
      .from('enrollment_audit_log')
      .insert({
        enrollment_id: enrollmentId,
        event_type: 'status_change',
        actor_profile_id: user.id,
        message: 'Enrollment submitted for review (from website)',
        data_before: { status: enrollment.status },
        data_after: { status: 'submitted', membership_id: membershipId },
      });

    // OPTIONAL approval routing (flag-gated; default OFF). Mirrors the public
    // submit route (apps/portal/src/app/api/enroll/submit/route.ts): when
    // ENROLLMENT_APPROVAL_ENABLED is on, evaluate the EXISTING approval rules
    // engine (trigger_type='enrollment_submit') via the shared @crm-eco/lib
    // adapter against the just-submitted enrollment. A matching rule parks it in
    // 'pending_review' instead of leaving it 'submitted'.
    //
    // Entirely non-fatal: any error here (incl. a missing enrollment_approvals
    // draft table) leaves the enrollment 'submitted' (the safe default) and never
    // fails the submit. base_monthly_cost is NEVER written by this block.
    if (ENROLLMENT_APPROVAL_ENABLED) {
      try {
        const orgId = enrollment.organization_id;
        const snapshot = enrollment.snapshot || {};
        const intake = snapshot.intake || {};
        const householdMembers: Array<{ relationship?: string; date_of_birth?: string }> =
          snapshot.household?.members ?? [];
        const coverageStart =
          enrollment.requested_effective_date ?? intake.requested_effective_date ?? null;

        // Derive ages / coverage tier from the persisted snapshot (the same source
        // of truth the wizard wrote). Ages are computed as of the coverage start.
        const asOf = coverageStart ? new Date(coverageStart) : new Date();
        const memberAge = ageOnDate(
          intake.date_of_birth ?? enrollment.primary_member?.date_of_birth ?? null,
          asOf,
        );
        const spouseRels = new Set(['spouse', 'partner', 'husband', 'wife']);
        let hasSpouse = false;
        let hasDependents = false;
        for (const h of householdMembers) {
          const rel = (h.relationship || '').toLowerCase();
          if (spouseRels.has(rel)) hasSpouse = true;
          else hasDependents = true;
        }
        const coverageTier =
          hasSpouse && hasDependents
            ? 'family'
            : hasSpouse
              ? 'member_spouse'
              : hasDependents
                ? 'member_children'
                : 'member';

        const approvalRecord = buildEnrollmentApprovalRecord({
          selectedPlanId: enrollment.selected_plan_id ?? null,
          effectiveDate: coverageStart,
          state: intake.state ?? enrollment.primary_member?.state ?? null,
          householdSize:
            enrollment.household_size ?? 1 + householdMembers.length,
          memberAge,
          hasSpouse,
          hasDependents,
          coverageTier,
          // READ-ONLY use of the already-persisted cost — never written here.
          baseMonthlyCost: Number(enrollment.base_monthly_cost ?? 0),
          totalMonthlyCost:
            enrollment.total_monthly_cost != null
              ? Number(enrollment.total_monthly_cost)
              : null,
          acknowledgments: snapshot.compliance ?? undefined,
        });

        const match = await checkEnrollmentApprovalRequired(supabase, orgId, approvalRecord);

        if (match) {
          const reviewReason = `Auto-routed for review by approval rule "${match.ruleName}"`;
          const { error: reviewErr } = await (supabase as any)
            .from('enrollments')
            .update({
              status: 'pending_review',
              status_reason: reviewReason,
            })
            .eq('id', enrollmentId)
            .eq('status', 'submitted'); // don't clobber a state an admin already changed

          if (!reviewErr) {
            await (supabase as any).from('enrollment_audit_log').insert({
              organization_id: orgId,
              enrollment_id: enrollmentId,
              event_type: 'status_change',
              old_status: 'submitted',
              new_status: 'pending_review',
              message: reviewReason,
              data_after: {
                approval_rule_id: match.ruleId,
                approval_rule_name: match.ruleName,
                approval_process_id: match.processId,
              },
            });

            // PARALLEL-BINDING approval row bound to enrollments(id). Idempotent
            // via the partial UNIQUE indexes (enrollment_id) WHERE status='pending'
            // and (idempotency_key) WHERE NOT NULL — a unique violation here is the
            // expected no-op on a retried submit and is swallowed below.
            try {
              await (supabase as any).from('enrollment_approvals').insert({
                org_id: orgId,
                enrollment_id: enrollmentId,
                rule_id: match.ruleId,
                process_id: match.processId,
                status: 'pending',
                requested_by: null,
                idempotency_key: `enroll_approval_${enrollmentId}`,
                context: {
                  rule_name: match.ruleName,
                  source: enrollment.enrollment_source ?? 'website',
                },
              });
            } catch {
              // A parallel-binding approval-row failure (incl. the expected unique
              // violation, or a missing draft table) must never break the submit.
              // The enrollment is already parked in 'pending_review' and audit-logged.
            }
          }
        }
      } catch {
        // Gating must never break a submit — leave the enrollment 'submitted'.
      }
    }

    revalidatePath('/enroll');

    return { success: true, data: { membershipId } };
  } catch (error) {
    console.error('submitSelfServeEnrollment error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
