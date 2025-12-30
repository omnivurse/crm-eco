'use server';

import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { computeEnrollmentWarnings, getRxPricingEstimate, validateMedications } from '@crm-eco/lib';
import type { MedicationInput, RxPricingResult } from '@crm-eco/lib';
import type { WizardSnapshot, HouseholdMember, EnrollmentMode } from '@/components/enrollment/wizard';

// Helper to get untyped Supabase client due to @supabase/ssr 0.5.x type inference limitations
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getSupabase(): Promise<any> {
  return await createServerSupabaseClient();
}

// ============================================================================
// Types
// ============================================================================

interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

interface IntakeStepData {
  enrollmentId: string;
  enrollmentMode?: EnrollmentMode;
  leadId?: string | null;
  memberId?: string | null;
  isNewMember: boolean;
  newMember?: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    dateOfBirth: string;
    state: string;
    city?: string;
    postalCode?: string;
    addressLine1?: string;
  };
  advisorId?: string | null;
  enrollmentSource?: string;
  channel?: string;
}

interface RxPricingData {
  enrollmentId: string;
  medications: MedicationInput[];
}

interface HouseholdStepData {
  enrollmentId: string;
  householdSize: number;
  members: HouseholdMember[];
}

interface PlanSelectionStepData {
  enrollmentId: string;
  selectedPlanId: string;
  requestedEffectiveDate: string;
}

interface ComplianceStepData {
  enrollmentId: string;
  healthshareAcknowledgement: boolean;
  guidelinesAcknowledgement: boolean;
  sharingLimitationsAcknowledgement: boolean;
  telehealthConsent: boolean;
  electronicCommunicationsConsent: boolean;
}

interface PaymentStepData {
  enrollmentId: string;
  fundingType: 'credit_card' | 'ach' | 'check' | 'other';
  billingFrequency: 'monthly' | 'annual';
  autoPay: boolean;
  billingAmount?: number;
  billingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
  };
}

// ============================================================================
// Initialize Enrollment (just returns success - actual creation happens in intake step)
// ============================================================================

export async function initializeEnrollment(advisorId?: string | null): Promise<ActionResult<{ enrollmentId: string }>> {
  try {
    const supabase = await getSupabase();
    
    // Get current user's profile to verify authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id, role')
      .eq('user_id', user.id)
      .single();
    
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    // We don't create the enrollment here because primary_member_id is required.
    // Return a temporary placeholder - the real enrollment will be created in completeIntakeStep
    return { success: true, data: { enrollmentId: 'pending' } };
  } catch (err) {
    console.error('Initialize enrollment error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ============================================================================
// Step 1: Intake
// ============================================================================

export async function completeIntakeStep(data: IntakeStepData): Promise<ActionResult<{ enrollmentId: string; memberId: string; state: string | null; dateOfBirth: string | null }>> {
  try {
    const supabase = await getSupabase();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id')
      .eq('user_id', user.id)
      .single();
    
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    let memberId = data.memberId;
    let memberState: string | null = null;
    let memberDob: string | null = null;

    // Create new member if needed
    if (data.isNewMember && data.newMember) {
      const { data: newMember, error: memberError } = await supabase
        .from('members')
        .insert({
          organization_id: profile.organization_id,
          first_name: data.newMember.firstName,
          last_name: data.newMember.lastName,
          email: data.newMember.email,
          phone: data.newMember.phone || null,
          date_of_birth: data.newMember.dateOfBirth,
          state: data.newMember.state,
          city: data.newMember.city || null,
          postal_code: data.newMember.postalCode || null,
          address_line1: data.newMember.addressLine1 || null,
          status: 'pending',
          advisor_id: data.advisorId || null,
        })
        .select('id, state, date_of_birth')
        .single();

      if (memberError) {
        return { success: false, error: `Failed to create member: ${memberError.message}` };
      }

      memberId = newMember.id;
      memberState = newMember.state;
      memberDob = newMember.date_of_birth;
    } else if (memberId) {
      // Fetch existing member data
      const { data: existingMember } = await supabase
        .from('members')
        .select('id, state, date_of_birth')
        .eq('id', memberId)
        .single();
      
      if (existingMember) {
        memberState = existingMember.state;
        memberDob = existingMember.date_of_birth;
      }
    }

    if (!memberId) {
      return { success: false, error: 'Member ID is required' };
    }

    const enrollmentMode = data.enrollmentMode || 'advisor_assisted';
    
    const snapshotIntake: WizardSnapshot['intake'] = {
      leadId: data.leadId,
      memberId,
      isNewMember: data.isNewMember,
      newMember: data.newMember,
      advisorId: data.advisorId,
      enrollmentSource: data.enrollmentSource,
      channel: data.channel,
    };

    let enrollmentId = data.enrollmentId;

    // If enrollmentId is 'pending', we need to create the enrollment now
    if (enrollmentId === 'pending') {
      const { data: enrollment, error: enrollmentError } = await supabase
        .from('enrollments')
        .insert({
          organization_id: profile.organization_id,
          primary_member_id: memberId,
          lead_id: data.leadId || null,
          advisor_id: data.advisorId || null,
          enrollment_source: data.enrollmentSource || null,
          channel: data.channel || null,
          enrollment_mode: enrollmentMode,
          status: 'draft',
          snapshot: { enrollmentMode, intake: snapshotIntake },
        })
        .select('id')
        .single();

      if (enrollmentError || !enrollment) {
        return { success: false, error: `Failed to create enrollment: ${enrollmentError?.message}` };
      }

      enrollmentId = enrollment.id;

      // Create enrollment steps
      const steps = ['intake', 'household', 'plan_selection', 'compliance', 'payment', 'confirmation'];
      const stepInserts = steps.map((stepKey) => ({
        organization_id: profile.organization_id,
        enrollment_id: enrollmentId,
        step_key: stepKey,
        is_completed: stepKey === 'intake',
        completed_at: stepKey === 'intake' ? new Date().toISOString() : null,
        payload: stepKey === 'intake' ? snapshotIntake : {},
      }));

      await supabase.from('enrollment_steps').insert(stepInserts);

      // Log audit events
      await supabase.from('enrollment_audit_log').insert([
        {
          organization_id: profile.organization_id,
          enrollment_id: enrollmentId,
          actor_profile_id: profile.id,
          event_type: 'created',
          new_status: 'draft',
          message: `Enrollment wizard started (mode: ${enrollmentMode})`,
          data_after: { enrollmentMode },
        },
        {
          organization_id: profile.organization_id,
          enrollment_id: enrollmentId,
          actor_profile_id: profile.id,
          event_type: 'step_completed',
          message: 'Intake step completed',
          data_after: snapshotIntake,
        },
      ]);
    } else {
      // Update existing enrollment
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('snapshot, enrollment_mode')
        .eq('id', enrollmentId)
        .single();

      const existingSnapshot = (enrollment?.snapshot as WizardSnapshot) || {};
      const oldMode = enrollment?.enrollment_mode;
      const modeChanged = oldMode !== enrollmentMode;
      
      const { error: updateError } = await supabase
        .from('enrollments')
        .update({
          primary_member_id: memberId,
          lead_id: data.leadId || null,
          advisor_id: data.advisorId || null,
          enrollment_source: data.enrollmentSource || null,
          channel: data.channel || null,
          enrollment_mode: enrollmentMode,
          snapshot: { ...existingSnapshot, enrollmentMode, intake: snapshotIntake },
          updated_at: new Date().toISOString(),
        })
        .eq('id', enrollmentId);

      // Log mode change if different
      if (modeChanged && !updateError) {
        await supabase.from('enrollment_audit_log').insert({
          organization_id: profile.organization_id,
          enrollment_id: enrollmentId,
          actor_profile_id: profile.id,
          event_type: 'field_update',
          message: `Enrollment mode changed from "${oldMode}" to "${enrollmentMode}"`,
          data_before: { enrollmentMode: oldMode },
          data_after: { enrollmentMode },
        });
      }

      if (updateError) {
        return { success: false, error: `Failed to update enrollment: ${updateError.message}` };
      }

      // Update enrollment step
      await supabase
        .from('enrollment_steps')
        .update({
          is_completed: true,
          completed_at: new Date().toISOString(),
          payload: snapshotIntake,
        })
        .eq('enrollment_id', enrollmentId)
        .eq('step_key', 'intake');

      // Log audit event
      await supabase.from('enrollment_audit_log').insert({
        organization_id: profile.organization_id,
        enrollment_id: enrollmentId,
        actor_profile_id: profile.id,
        event_type: 'step_completed',
        message: 'Intake step completed',
        data_after: snapshotIntake,
      });
    }

    return { 
      success: true, 
      data: { 
        enrollmentId,
        memberId, 
        state: memberState, 
        dateOfBirth: memberDob 
      } 
    };
  } catch (err) {
    console.error('Complete intake step error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ============================================================================
// Step 2: Household
// ============================================================================

export async function completeHouseholdStep(data: HouseholdStepData): Promise<ActionResult> {
  try {
    const supabase = await getSupabase();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id')
      .eq('user_id', user.id)
      .single();
    
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    const snapshotHousehold: WizardSnapshot['household'] = {
      householdSize: data.householdSize,
      members: data.members,
    };

    // Update enrollment with household size
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('snapshot')
      .eq('id', data.enrollmentId)
      .single();

    const existingSnapshot = (enrollment?.snapshot as WizardSnapshot) || {};
    
    await supabase
      .from('enrollments')
      .update({
        household_size: data.householdSize,
        snapshot: { ...existingSnapshot, household: snapshotHousehold },
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.enrollmentId);

    // Update enrollment step
    await supabase
      .from('enrollment_steps')
      .update({
        is_completed: true,
        completed_at: new Date().toISOString(),
        payload: snapshotHousehold,
      })
      .eq('enrollment_id', data.enrollmentId)
      .eq('step_key', 'household');

    // Log audit event
    await supabase.from('enrollment_audit_log').insert({
      organization_id: profile.organization_id,
      enrollment_id: data.enrollmentId,
      actor_profile_id: profile.id,
      event_type: 'step_completed',
      message: 'Household step completed',
      data_after: snapshotHousehold,
    });

    return { success: true };
  } catch (err) {
    console.error('Complete household step error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ============================================================================
// Step 3: Plan Selection
// ============================================================================

export async function completePlanSelectionStep(data: PlanSelectionStepData): Promise<ActionResult<{ hasMandateWarning: boolean; hasAge65Warning: boolean }>> {
  try {
    const supabase = await getSupabase();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id')
      .eq('user_id', user.id)
      .single();
    
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    // Get enrollment with member data for warnings
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select(`
        snapshot,
        selected_plan_id,
        members:primary_member_id (state, date_of_birth)
      `)
      .eq('id', data.enrollmentId)
      .single();

    if (!enrollment) {
      return { success: false, error: 'Enrollment not found' };
    }

    const member = enrollment.members as { state: string | null; date_of_birth: string | null } | null;
    const warnings = computeEnrollmentWarnings(member?.state, member?.date_of_birth);

    const snapshotPlanSelection: WizardSnapshot['plan_selection'] = {
      selectedPlanId: data.selectedPlanId,
      requestedEffectiveDate: data.requestedEffectiveDate,
      hasMandateWarning: warnings.has_mandate_warning,
      hasAge65Warning: warnings.has_age65_warning,
    };

    const existingSnapshot = (enrollment.snapshot as WizardSnapshot) || {};
    const oldPlanId = enrollment.selected_plan_id;
    
    await supabase
      .from('enrollments')
      .update({
        selected_plan_id: data.selectedPlanId,
        requested_effective_date: data.requestedEffectiveDate,
        has_mandate_warning: warnings.has_mandate_warning,
        has_age65_warning: warnings.has_age65_warning,
        snapshot: { ...existingSnapshot, plan_selection: snapshotPlanSelection },
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.enrollmentId);

    // Update enrollment step
    await supabase
      .from('enrollment_steps')
      .update({
        is_completed: true,
        completed_at: new Date().toISOString(),
        payload: snapshotPlanSelection,
      })
      .eq('enrollment_id', data.enrollmentId)
      .eq('step_key', 'plan_selection');

    // Log audit event
    await supabase.from('enrollment_audit_log').insert({
      organization_id: profile.organization_id,
      enrollment_id: data.enrollmentId,
      actor_profile_id: profile.id,
      event_type: 'step_completed',
      message: oldPlanId !== data.selectedPlanId 
        ? `Plan selection updated to ${data.selectedPlanId}` 
        : 'Plan selection step completed',
      data_before: oldPlanId ? { selectedPlanId: oldPlanId } : null,
      data_after: snapshotPlanSelection,
    });

    return { 
      success: true, 
      data: { 
        hasMandateWarning: warnings.has_mandate_warning, 
        hasAge65Warning: warnings.has_age65_warning 
      } 
    };
  } catch (err) {
    console.error('Complete plan selection step error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ============================================================================
// Step 4: Compliance
// ============================================================================

export async function completeComplianceStep(data: ComplianceStepData): Promise<ActionResult> {
  try {
    const supabase = await getSupabase();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id')
      .eq('user_id', user.id)
      .single();
    
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    // Validate all required acknowledgements
    if (!data.healthshareAcknowledgement || !data.guidelinesAcknowledgement || !data.sharingLimitationsAcknowledgement) {
      return { success: false, error: 'All acknowledgements must be accepted' };
    }

    const snapshotCompliance: WizardSnapshot['compliance'] = {
      healthshareAcknowledgement: data.healthshareAcknowledgement,
      guidelinesAcknowledgement: data.guidelinesAcknowledgement,
      sharingLimitationsAcknowledgement: data.sharingLimitationsAcknowledgement,
      telehealthConsent: data.telehealthConsent,
      electronicCommunicationsConsent: data.electronicCommunicationsConsent,
    };

    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('snapshot')
      .eq('id', data.enrollmentId)
      .single();

    const existingSnapshot = (enrollment?.snapshot as WizardSnapshot) || {};
    
    await supabase
      .from('enrollments')
      .update({
        snapshot: { ...existingSnapshot, compliance: snapshotCompliance },
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.enrollmentId);

    // Update enrollment step
    await supabase
      .from('enrollment_steps')
      .update({
        is_completed: true,
        completed_at: new Date().toISOString(),
        payload: snapshotCompliance,
      })
      .eq('enrollment_id', data.enrollmentId)
      .eq('step_key', 'compliance');

    // Log audit event
    await supabase.from('enrollment_audit_log').insert({
      organization_id: profile.organization_id,
      enrollment_id: data.enrollmentId,
      actor_profile_id: profile.id,
      event_type: 'step_completed',
      message: 'Compliance step completed',
      data_after: snapshotCompliance,
    });

    return { success: true };
  } catch (err) {
    console.error('Complete compliance step error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ============================================================================
// Step 5: Payment
// ============================================================================

export async function completePaymentStep(data: PaymentStepData): Promise<ActionResult> {
  try {
    const supabase = await getSupabase();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id')
      .eq('user_id', user.id)
      .single();
    
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    const snapshotPayment: WizardSnapshot['payment'] = {
      fundingType: data.fundingType,
      billingFrequency: data.billingFrequency,
      autoPay: data.autoPay,
      billingAmount: data.billingAmount,
      billingAddress: data.billingAddress,
    };

    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('snapshot')
      .eq('id', data.enrollmentId)
      .single();

    const existingSnapshot = (enrollment?.snapshot as WizardSnapshot) || {};
    
    await supabase
      .from('enrollments')
      .update({
        snapshot: { ...existingSnapshot, payment: snapshotPayment },
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.enrollmentId);

    // Update enrollment step
    await supabase
      .from('enrollment_steps')
      .update({
        is_completed: true,
        completed_at: new Date().toISOString(),
        payload: snapshotPayment,
      })
      .eq('enrollment_id', data.enrollmentId)
      .eq('step_key', 'payment');

    // Log audit event
    await supabase.from('enrollment_audit_log').insert({
      organization_id: profile.organization_id,
      enrollment_id: data.enrollmentId,
      actor_profile_id: profile.id,
      event_type: 'step_completed',
      message: 'Payment step completed',
      data_after: snapshotPayment,
    });

    return { success: true };
  } catch (err) {
    console.error('Complete payment step error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ============================================================================
// Step 6: Submit Enrollment
// ============================================================================

export async function submitEnrollment(enrollmentId: string, finalAcceptance: boolean): Promise<ActionResult<{ membershipId: string }>> {
  try {
    if (!finalAcceptance) {
      return { success: false, error: 'Final acceptance is required' };
    }

    const supabase = await getSupabase();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id')
      .eq('user_id', user.id)
      .single();
    
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    // Verify all steps are completed
    const { data: steps } = await supabase
      .from('enrollment_steps')
      .select('step_key, is_completed')
      .eq('enrollment_id', enrollmentId);

    type StepData = { step_key: string; is_completed: boolean };
    const stepsTyped = steps as StepData[] | null;
    const requiredSteps = ['intake', 'household', 'plan_selection', 'compliance', 'payment'];
    const incompleteSteps = requiredSteps.filter(
      (stepKey) => !stepsTyped?.find((s: StepData) => s.step_key === stepKey && s.is_completed)
    );

    if (incompleteSteps.length > 0) {
      return { success: false, error: `Incomplete steps: ${incompleteSteps.join(', ')}` };
    }

    // Get enrollment with all related data
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select(`
        *,
        plans:selected_plan_id (monthly_share)
      `)
      .eq('id', enrollmentId)
      .single();

    if (!enrollment) {
      return { success: false, error: 'Enrollment not found' };
    }

    const snapshot = enrollment.snapshot as WizardSnapshot;
    const plan = enrollment.plans as { monthly_share: number | null } | null;

    // Generate membership number
    const year = new Date().getFullYear();
    const { count } = await supabase
      .from('memberships')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', profile.organization_id);
    
    const membershipNumber = `WS-${year}-${String((count || 0) + 1).padStart(6, '0')}`;

    // Create membership
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .insert({
        organization_id: profile.organization_id,
        member_id: enrollment.primary_member_id,
        plan_id: enrollment.selected_plan_id,
        advisor_id: enrollment.advisor_id,
        membership_number: membershipNumber,
        status: 'pending',
        effective_date: enrollment.requested_effective_date || new Date().toISOString().split('T')[0],
        billing_amount: snapshot.payment?.billingAmount || plan?.monthly_share || 0,
        billing_frequency: snapshot.payment?.billingFrequency || 'monthly',
        funding_type: snapshot.payment?.fundingType || null,
      })
      .select('id')
      .single();

    if (membershipError) {
      return { success: false, error: `Failed to create membership: ${membershipError.message}` };
    }

    // Update enrollment status
    const existingSnapshot = (enrollment.snapshot as WizardSnapshot) || {};
    const snapshotConfirmation: WizardSnapshot['confirmation'] = { finalAcceptance: true };

    await supabase
      .from('enrollments')
      .update({
        status: 'submitted',
        effective_date: enrollment.requested_effective_date,
        snapshot: { ...existingSnapshot, confirmation: snapshotConfirmation },
        updated_at: new Date().toISOString(),
      })
      .eq('id', enrollmentId);

    // Mark confirmation step complete
    await supabase
      .from('enrollment_steps')
      .update({
        is_completed: true,
        completed_at: new Date().toISOString(),
        payload: { finalAcceptance: true, membershipId: membership.id },
      })
      .eq('enrollment_id', enrollmentId)
      .eq('step_key', 'confirmation');

    // Log audit event
    await supabase.from('enrollment_audit_log').insert({
      organization_id: profile.organization_id,
      enrollment_id: enrollmentId,
      actor_profile_id: profile.id,
      event_type: 'status_change',
      old_status: enrollment.status,
      new_status: 'submitted',
      message: 'Enrollment submitted and membership created',
      data_after: { membershipId: membership.id, membershipNumber },
    });

    return { success: true, data: { membershipId: membership.id } };
  } catch (err) {
    console.error('Submit enrollment error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ============================================================================
// Rx Pricing: Get medication pricing estimates
// ============================================================================

export async function runRxPricing(data: RxPricingData): Promise<ActionResult<RxPricingResult>> {
  try {
    const supabase = await getSupabase();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id')
      .eq('user_id', user.id)
      .single();
    
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    // Validate medications
    const validationError = validateMedications(data.medications);
    if (validationError) {
      return { success: false, error: validationError };
    }

    // Get enrollment with member data for pricing context
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select(`
        snapshot,
        selected_plan_id,
        members:primary_member_id (state)
      `)
      .eq('id', data.enrollmentId)
      .single();

    if (enrollmentError || !enrollment) {
      return { success: false, error: 'Enrollment not found' };
    }

    const member = enrollment.members as { state: string | null } | null;

    // Call the pricing estimate function
    const pricingResult = await getRxPricingEstimate({
      meds: data.medications,
      memberState: member?.state || undefined,
      planId: enrollment.selected_plan_id || undefined,
    });

    // Update enrollment with medications and pricing result
    const existingSnapshot = (enrollment.snapshot as WizardSnapshot) || {};
    
    await supabase
      .from('enrollments')
      .update({
        rx_medications: data.medications,
        rx_pricing_result: pricingResult,
        snapshot: {
          ...existingSnapshot,
          plan_selection: {
            ...existingSnapshot.plan_selection,
            selectedPlanId: existingSnapshot.plan_selection?.selectedPlanId || '',
            requestedEffectiveDate: existingSnapshot.plan_selection?.requestedEffectiveDate || '',
            rxMedications: data.medications,
            rxPricingResult: pricingResult,
          },
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.enrollmentId);

    // Log audit event
    await supabase.from('enrollment_audit_log').insert({
      organization_id: profile.organization_id,
      enrollment_id: data.enrollmentId,
      actor_profile_id: profile.id,
      event_type: 'field_update',
      message: `Rx pricing estimate generated for ${data.medications.length} medication(s)`,
      data_after: {
        medicationCount: data.medications.length,
        pricingSummary: pricingResult.summary,
      },
    });

    return { success: true, data: pricingResult };
  } catch (err) {
    console.error('Run Rx pricing error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ============================================================================
// Helper: Get enrollment data for resuming wizard
// ============================================================================

export async function getEnrollmentWizardData(enrollmentId: string): Promise<ActionResult<{
  enrollment: {
    id: string;
    status: string;
    snapshot: WizardSnapshot;
    primaryMemberId: string | null;
    advisorId: string | null;
    selectedPlanId: string | null;
    hasMandateWarning: boolean;
    hasAge65Warning: boolean;
  };
  stepStatuses: Record<string, { isCompleted: boolean; completedAt?: string }>;
}>> {
  try {
    const supabase = await getSupabase();
    
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('*, members:primary_member_id (state, date_of_birth)')
      .eq('id', enrollmentId)
      .single();

    if (enrollmentError || !enrollment) {
      return { success: false, error: 'Enrollment not found' };
    }

    const { data: steps } = await supabase
      .from('enrollment_steps')
      .select('step_key, is_completed, completed_at')
      .eq('enrollment_id', enrollmentId);

    interface StepRecord {
      step_key: string;
      is_completed: boolean;
      completed_at: string | null;
    }

    const stepStatuses: Record<string, { isCompleted: boolean; completedAt?: string }> = {};
    (steps as StepRecord[] | null)?.forEach((step) => {
      stepStatuses[step.step_key] = {
        isCompleted: step.is_completed,
        completedAt: step.completed_at || undefined,
      };
    });

    return {
      success: true,
      data: {
        enrollment: {
          id: enrollment.id,
          status: enrollment.status,
          snapshot: (enrollment.snapshot as WizardSnapshot) || {},
          primaryMemberId: enrollment.primary_member_id,
          advisorId: enrollment.advisor_id,
          selectedPlanId: enrollment.selected_plan_id,
          hasMandateWarning: enrollment.has_mandate_warning || false,
          hasAge65Warning: enrollment.has_age65_warning || false,
        },
        stepStatuses,
      },
    };
  } catch (err) {
    console.error('Get enrollment wizard data error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

