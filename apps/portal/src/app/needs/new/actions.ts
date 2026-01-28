'use server';

import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getMemberForUser } from '@crm-eco/lib';
import { revalidatePath } from 'next/cache';

// ============================================================================
// Types
// ============================================================================

interface ActionResult {
  success: boolean;
  message: string;
  needId?: string;
  errors?: Record<string, string[]>;
}

interface NeedBasicsData {
  needType: string;
  description: string;
  incidentDate: string;
  facilityName: string;
}

interface BillsAndCashPayData {
  hasPaidProvider: boolean;
  amountPaid?: number;
  paymentMethod?: string;
  paymentDate?: string;
  billedAmount?: number;
}

interface ConsentData {
  hasConsent: boolean;
}

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Create a new need from basics (Step 1)
 */
export async function createNeedFromBasics(data: NeedBasicsData): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: 'Authentication required.' };
  }

  const context = await getMemberForUser(supabase, user.id);

  if (!context) {
    return { success: false, message: 'Member profile not found.' };
  }

  const { member, profile } = context;

  // Validate required fields
  const errors: Record<string, string[]> = {};
  if (!data.needType || data.needType.trim().length === 0) {
    errors.needType = ['Need type is required.'];
  }
  if (!data.description || data.description.trim().length === 0) {
    errors.description = ['Description is required.'];
  }
  if (!data.incidentDate) {
    errors.incidentDate = ['Service date is required.'];
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, message: 'Validation failed.', errors };
  }

  // Create the need
  // Note: Using type assertion because some columns are from a newer migration
  const needInsert = {
    organization_id: member.organization_id,
    member_id: member.id,
    need_type: data.needType.trim(),
    description: data.description.trim(),
    incident_date: data.incidentDate,
    facility_name: data.facilityName?.trim() || null,
    status: 'open',
    urgency_light: 'green',
    total_amount: 0,
    eligible_amount: 0,
    reimbursed_amount: 0,
    iua_amount: 0,
    payment_status: 'not_paid',
    reimbursement_status: 'not_requested',
    has_member_consent: false,
  };

  const { data: newNeed, error: needError } = await (supabase as any)
    .from('needs')
    .insert(needInsert)
    .select()
    .single();

  if (needError || !newNeed) {
    console.error('Error creating need:', needError);
    return { success: false, message: 'Failed to create need. Please try again.' };
  }

  // Create the initial event
  const { error: eventError } = await (supabase as any)
    .from('need_events')
    .insert({
      need_id: newNeed.id,
      organization_id: member.organization_id,
      event_type: 'created',
      description: 'Need created by member',
      created_by_profile_id: profile.id,
    });

  if (eventError) {
    console.error('Error creating need event:', eventError);
    // Don't fail the whole operation, just log
  }

  return {
    success: true,
    message: 'Need created successfully.',
    needId: newNeed.id,
  };
}

/**
 * Update need with bills and cash pay info (Step 2)
 */
export async function updateNeedBillsAndCashPay(
  needId: string,
  data: BillsAndCashPayData
): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: 'Authentication required.' };
  }

  const context = await getMemberForUser(supabase, user.id);

  if (!context) {
    return { success: false, message: 'Member profile not found.' };
  }

  const { member, profile } = context;

  // Verify ownership
  const { data: existingNeed, error: fetchError } = await supabase
    .from('needs')
    .select('id, member_id, organization_id')
    .eq('id', needId)
    .eq('member_id', member.id)
    .eq('organization_id', member.organization_id)
    .single();

  if (fetchError || !existingNeed) {
    return { success: false, message: 'Need not found or access denied.' };
  }

  // Build update object
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (data.hasPaidProvider) {
    updateData.payment_status = 'paid';
    updateData.amount_paid = data.amountPaid || 0;
    updateData.payment_method = data.paymentMethod || null;
    updateData.payment_date = data.paymentDate || null;
    updateData.total_amount = data.amountPaid || data.billedAmount || 0;
  } else {
    updateData.payment_status = 'not_paid';
    updateData.total_amount = data.billedAmount || 0;
  }

  // Update the need
  const { error: updateError } = await (supabase as any)
    .from('needs')
    .update(updateData)
    .eq('id', needId);

  if (updateError) {
    console.error('Error updating need:', updateError);
    return { success: false, message: 'Failed to update need. Please try again.' };
  }

  // Create event for the update
  const eventDescription = data.hasPaidProvider
    ? `Member reported payment of $${data.amountPaid?.toFixed(2) || '0.00'} via ${data.paymentMethod || 'unknown method'}`
    : data.billedAmount
      ? `Bill amount of $${data.billedAmount.toFixed(2)} recorded`
      : 'Payment information updated';

  await (supabase as any)
    .from('need_events')
    .insert({
      need_id: needId,
      organization_id: member.organization_id,
      event_type: 'payment_recorded',
      description: eventDescription,
      created_by_profile_id: profile.id,
    });

  return {
    success: true,
    message: 'Payment information saved.',
    needId,
  };
}

/**
 * Update need with consent and documents info (Step 3)
 */
export async function updateNeedConsentAndDocs(
  needId: string,
  data: ConsentData
): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: 'Authentication required.' };
  }

  const context = await getMemberForUser(supabase, user.id);

  if (!context) {
    return { success: false, message: 'Member profile not found.' };
  }

  const { member, profile } = context;

  // Verify ownership
  const { data: existingNeed, error: fetchError } = await supabase
    .from('needs')
    .select('id, member_id, organization_id')
    .eq('id', needId)
    .eq('member_id', member.id)
    .eq('organization_id', member.organization_id)
    .single();

  if (fetchError || !existingNeed) {
    return { success: false, message: 'Need not found or access denied.' };
  }

  if (!data.hasConsent) {
    return {
      success: false,
      message: 'You must provide consent to proceed.',
      errors: { hasConsent: ['Consent is required to submit your need.'] },
    };
  }

  // Update the need
  const { error: updateError } = await (supabase as any)
    .from('needs')
    .update({
      has_member_consent: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', needId);

  if (updateError) {
    console.error('Error updating need consent:', updateError);
    return { success: false, message: 'Failed to save consent. Please try again.' };
  }

  // Create event
  await (supabase as any)
    .from('need_events')
    .insert({
      need_id: needId,
      organization_id: member.organization_id,
      event_type: 'consent_recorded',
      description: 'Member consent recorded for medical records access',
      created_by_profile_id: profile.id,
    });

  return {
    success: true,
    message: 'Consent recorded.',
    needId,
  };
}

/**
 * Submit need for review (Step 4 final submission)
 */
export async function submitNeedForReview(needId: string): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: 'Authentication required.' };
  }

  const context = await getMemberForUser(supabase, user.id);

  if (!context) {
    return { success: false, message: 'Member profile not found.' };
  }

  const { member, profile } = context;

  // Verify ownership and get current status
  const { data: existingNeed, error: fetchError } = await (supabase as any)
    .from('needs')
    .select('id, member_id, organization_id, status, has_member_consent')
    .eq('id', needId)
    .eq('member_id', member.id)
    .eq('organization_id', member.organization_id)
    .single();

  if (fetchError || !existingNeed) {
    return { success: false, message: 'Need not found or access denied.' };
  }

  // Validate consent
  if (!existingNeed.has_member_consent) {
    return {
      success: false,
      message: 'You must provide consent before submitting your need.',
    };
  }

  // Update status to in_review
  const { error: updateError } = await (supabase as any)
    .from('needs')
    .update({
      status: 'in_review',
      updated_at: new Date().toISOString(),
    })
    .eq('id', needId);

  if (updateError) {
    console.error('Error submitting need:', updateError);
    return { success: false, message: 'Failed to submit need. Please try again.' };
  }

  // Create submission event
  await (supabase as any)
    .from('need_events')
    .insert({
      need_id: needId,
      organization_id: member.organization_id,
      event_type: 'submitted',
      description: 'Need submitted for review by member',
      old_status: existingNeed.status,
      new_status: 'in_review',
      created_by_profile_id: profile.id,
    });

  revalidatePath('/needs');
  revalidatePath(`/needs/${needId}`);

  return {
    success: true,
    message: 'Your need has been submitted for review!',
    needId,
  };
}

