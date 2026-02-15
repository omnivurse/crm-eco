'use server';

import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getMemberForUser, getRxPricingEstimate, validateMedications } from '@crm-eco/lib';
import type { MedicationInput, RxPricingResult } from '@crm-eco/lib';
import type { ActionResult, IntakeData, HouseholdMember, PlanSelectionData, ComplianceData, PaymentData } from '@crm-eco/enrollment';
import { revalidatePath } from 'next/cache';

// ============================================================================
// Helper Functions
// ============================================================================

async function getOrCreateEnrollment(enrollmentId?: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  const context = await getMemberForUser(supabase, user.id);

  if (enrollmentId) {
    const { data: enrollment, error } = await (supabase as any)
      .from('enrollments')
      .select('*, primary_member:primary_member_id(*)')
      .eq('id', enrollmentId)
      .single();

    if (error || !enrollment) {
      return { error: 'Enrollment not found' };
    }

    if (context?.member && enrollment.primary_member_id !== context.member.id) {
      return { error: 'Access denied' };
    }

    return { supabase, user, context, enrollment };
  }

  return { supabase, user, context, enrollment: null };
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

    const { supabase, user, context } = result;

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

    // Set advisor_id if provided (e.g., from a landing page)
    if (options?.advisorId) {
      enrollmentData.advisor_id = options.advisorId;
    }

    if (context?.member) {
      enrollmentData.primary_member_id = context.member.id;
      enrollmentData.organization_id = context.member.organization_id;

      // Also set the advisor on the member record if not already set
      if (options?.advisorId && !context.member.advisor_id) {
        await (supabase as any)
          .from('members')
          .update({ advisor_id: options.advisorId })
          .eq('id', context.member.id);
      }
    } else {
      const { data: org } = await (supabase as any)
        .from('organizations')
        .select('id')
        .limit(1)
        .single();

      if (org) {
        enrollmentData.organization_id = org.id;
      }
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
        user_id: user.id,
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
        enrollment_id: enrollmentId,
        step_key: 'intake',
        status: 'completed',
        completed_at: new Date().toISOString(),
        data: data,
      }, { onConflict: 'enrollment_id,step_key' });

    await (supabase as any)
      .from('enrollment_audit_log')
      .insert({
        enrollment_id: enrollmentId,
        event_type: 'step_completed',
        user_id: user.id,
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
        enrollment_id: enrollmentId,
        step_key: 'household',
        status: 'completed',
        completed_at: new Date().toISOString(),
        data: { members },
      }, { onConflict: 'enrollment_id,step_key' });

    await (supabase as any)
      .from('enrollment_audit_log')
      .insert({
        enrollment_id: enrollmentId,
        event_type: 'step_completed',
        user_id: user.id,
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
        enrollment_id: enrollmentId,
        step_key: 'plan_selection',
        status: 'completed',
        completed_at: new Date().toISOString(),
        data: { plan_id: data.selected_plan_id, effective_date: data.requested_effective_date },
      }, { onConflict: 'enrollment_id,step_key' });

    await (supabase as any)
      .from('enrollment_audit_log')
      .insert({
        enrollment_id: enrollmentId,
        event_type: 'step_completed',
        user_id: user.id,
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
        user_id: user.id,
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
        enrollment_id: enrollmentId,
        step_key: 'compliance',
        status: 'completed',
        completed_at: new Date().toISOString(),
        data: { signed_at: new Date().toISOString() },
      }, { onConflict: 'enrollment_id,step_key' });

    await (supabase as any)
      .from('enrollment_audit_log')
      .insert({
        enrollment_id: enrollmentId,
        event_type: 'step_completed',
        user_id: user.id,
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
        enrollment_id: enrollmentId,
        step_key: 'payment',
        status: 'completed',
        completed_at: new Date().toISOString(),
        data: { payment_method: data.payment_method },
      }, { onConflict: 'enrollment_id,step_key' });

    await (supabase as any)
      .from('enrollment_audit_log')
      .insert({
        enrollment_id: enrollmentId,
        event_type: 'step_completed',
        user_id: user.id,
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
      .select('step_key, status')
      .eq('enrollment_id', enrollmentId);

    const requiredSteps = ['intake', 'household', 'plan_selection', 'compliance', 'payment'];
    const completedSteps = new Set(
      (steps || [])
        .filter((s: { status: string }) => s.status === 'completed')
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
        enrollment_id: enrollmentId,
        step_key: 'confirmation',
        status: 'completed',
        completed_at: new Date().toISOString(),
        data: { submitted: true },
      }, { onConflict: 'enrollment_id,step_key' });

    await (supabase as any)
      .from('enrollment_audit_log')
      .insert({
        enrollment_id: enrollmentId,
        event_type: 'status_change',
        user_id: user.id,
        message: 'Enrollment submitted for review (from website)',
        data_before: { status: enrollment.status },
        data_after: { status: 'submitted', membership_id: membershipId },
      });

    revalidatePath('/enroll');

    return { success: true, data: { membershipId } };
  } catch (error) {
    console.error('submitSelfServeEnrollment error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
