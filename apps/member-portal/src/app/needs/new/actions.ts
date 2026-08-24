'use server';

import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getMemberForUser } from '@crm-eco/lib';
import { revalidatePath } from 'next/cache';

// ============================================================================
// Types — mirror the "Sharing Request" form
// ============================================================================

interface ActionResult {
  success: boolean;
  message: string;
  needId?: string;
  errors?: Record<string, string[]>;
}

type YesNo = 'yes' | 'no' | '';

export interface ShareRequestData {
  /** "I have read the instructions above." */
  acknowledgedInstructions: boolean;

  // Member Information (pre-filled from the member record, editable).
  firstName: string;
  lastName: string;
  memberIdCard: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  otherInsurance: YesNo;

  // Optional patient attribution (member self or a dependent).
  patientType?: 'self' | 'dependent';
  patientDependentId?: string;
  patientName?: string;

  // Request details.
  requestType: string;
  treatmentType?: string;
  usedAmbulance: YesNo;
  initialDateOfService: string;
  symptomsBeforeService: YesNo;
  facilityName?: string;
  primaryCare?: string;
  detailedDescription: string;
  hasItemizedSelfPayStatement: YesNo;
  inquiredFinancialAssistance: YesNo;
}

// ============================================================================
// Create the sharing request (single submit at the end of the details step)
// ============================================================================

export async function createShareRequest(data: ShareRequestData): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: 'Authentication required.' };
  }

  const context = await getMemberForUser(supabase, user.id);
  if (!context) {
    return { success: false, message: 'Member profile not found.' };
  }

  const { member, profile } = context;
  if (!member.organization_id) {
    return { success: false, message: 'Organization not found.' };
  }

  // ── Validation (mirrors the form's required * fields) ──
  const errors: Record<string, string[]> = {};
  const requireText = (key: keyof ShareRequestData, label: string) => {
    const v = data[key];
    if (typeof v !== 'string' || v.trim().length === 0) errors[key] = [`${label} is required.`];
  };
  const requireAnswer = (key: keyof ShareRequestData, label: string) => {
    if (data[key] !== 'yes' && data[key] !== 'no') errors[key] = [`${label} is required.`];
  };

  if (!data.acknowledgedInstructions) {
    errors.acknowledgedInstructions = ['Please confirm you have read the instructions.'];
  }
  requireText('firstName', 'First name');
  requireText('lastName', 'Last name');
  requireText('memberIdCard', 'Member ID');
  requireText('dateOfBirth', 'Date of birth');
  requireText('email', 'Preferred email');
  requireText('phone', 'Preferred phone');
  requireText('requestType', 'Request type');
  requireText('initialDateOfService', 'Initial date of service');
  requireText('detailedDescription', 'Detailed description');
  requireAnswer('hasItemizedSelfPayStatement', 'Itemized statement question');
  requireAnswer('inquiredFinancialAssistance', 'Financial assistance question');

  if (Object.keys(errors).length > 0) {
    return { success: false, message: 'Please complete the required fields.', errors };
  }

  // Extended share-request fields live in `custom_fields` JSONB (no migration).
  const needInsert = {
    organization_id: member.organization_id,
    member_id: member.id,
    need_type: data.requestType.trim(),
    description: data.detailedDescription.trim(),
    incident_date: data.initialDateOfService,
    facility_name: data.facilityName?.trim() || null,
    status: 'open',
    urgency_light: 'green',
    total_amount: 0,
    eligible_amount: 0,
    reimbursed_amount: 0,
    iua_amount: 0,
    payment_status: 'not_paid',
    reimbursement_status: 'not_requested',
    // The instructions acknowledgement doubles as the member's consent.
    has_member_consent: true,
    custom_fields: {
      share_request: {
        acknowledged_instructions: true,
        member_info: {
          first_name: data.firstName.trim(),
          last_name: data.lastName.trim(),
          member_id_card: data.memberIdCard.trim(),
          date_of_birth: data.dateOfBirth,
          email: data.email.trim(),
          phone: data.phone.trim(),
        },
        patient: {
          type: data.patientType || 'self',
          dependent_id: data.patientType === 'dependent' ? data.patientDependentId || null : null,
          name: data.patientName?.trim() || null,
        },
        other_insurance: data.otherInsurance || '',
        request_type: data.requestType.trim(),
        treatment_type: data.treatmentType?.trim() || null,
        used_ambulance: data.usedAmbulance || '',
        symptoms_before_service: data.symptomsBeforeService || '',
        primary_care: data.primaryCare?.trim() || null,
        detailed_description: data.detailedDescription.trim(),
        has_itemized_self_pay_statement: data.hasItemizedSelfPayStatement,
        inquired_financial_assistance: data.inquiredFinancialAssistance,
      },
    },
  };

  const { data: newNeed, error: needError } = await (supabase as any)
    .from('needs')
    .insert(needInsert)
    .select()
    .single();

  if (needError || !newNeed) {
    console.error('createShareRequest insert failed', {
      code: needError?.code,
      message: needError?.message,
      details: needError?.details,
    });
    return {
      success: false,
      message: needError?.message
        ? `Failed to create your request: ${needError.message}`
        : 'Failed to create your request. Please try again.',
    };
  }

  // Initial audit event (best-effort).
  await (supabase as any).from('need_events').insert({
    need_id: newNeed.id,
    organization_id: member.organization_id,
    event_type: 'created',
    description: 'Sharing request created by member',
    created_by_profile_id: profile.id,
  });

  revalidatePath('/needs');
  revalidatePath('/');

  return { success: true, message: 'Request created.', needId: newNeed.id };
}

// ============================================================================
// Final submission (after documents are attached)
// ============================================================================

export async function submitNeedForReview(needId: string): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: 'Authentication required.' };
  }

  const context = await getMemberForUser(supabase, user.id);
  if (!context) {
    return { success: false, message: 'Member profile not found.' };
  }

  const { member, profile } = context;
  if (!member.organization_id) {
    return { success: false, message: 'Organization not found.' };
  }

  const { data: existingNeed, error: fetchError } = await (supabase as any)
    .from('needs')
    .select('id, member_id, organization_id, status, has_member_consent')
    .eq('id', needId)
    .eq('member_id', member.id)
    .eq('organization_id', member.organization_id)
    .single();

  if (fetchError || !existingNeed) {
    return { success: false, message: 'Request not found or access denied.' };
  }

  if (!existingNeed.has_member_consent) {
    return {
      success: false,
      message: 'Please confirm you have read the instructions before submitting.',
    };
  }

  const { error: updateError } = await (supabase as any)
    .from('needs')
    .update({ status: 'in_review', updated_at: new Date().toISOString() })
    .eq('id', needId);

  if (updateError) {
    return { success: false, message: 'Failed to submit your request. Please try again.' };
  }

  await (supabase as any).from('need_events').insert({
    need_id: needId,
    organization_id: member.organization_id,
    event_type: 'submitted',
    description: 'Sharing request submitted for review by member',
    old_status: existingNeed.status,
    new_status: 'in_review',
    created_by_profile_id: profile.id,
  });

  revalidatePath('/needs');
  revalidatePath(`/needs/${needId}`);
  revalidatePath('/');

  return { success: true, message: 'Your request has been submitted for review!', needId };
}
