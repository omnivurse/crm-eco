'use server';

import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { getNeedStatusLabel, type NeedStatus } from '@crm-eco/lib';

// Ops roles that can access the command center
const OPS_ROLES = ['owner', 'admin', 'staff'];

/**
 * Verify the current user is an Ops role and get their profile
 */
async function verifyOpsAccess() {
  const profile = await getCurrentProfile();
  
  if (!profile) {
    throw new Error('Not authenticated');
  }
  
  if (!OPS_ROLES.includes(profile.role)) {
    throw new Error('Not authorized - Ops role required');
  }
  
  return profile;
}

/**
 * Verify a Need belongs to the user's organization
 */
async function verifyNeedOwnership(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  needId: string,
  organizationId: string
): Promise<{ id: string; status: string; organization_id: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: need, error } = await (supabase as any)
    .from('needs')
    .select('id, status, organization_id')
    .eq('id', needId)
    .eq('organization_id', organizationId)
    .single();
  
  if (error || !need) {
    throw new Error('Need not found or access denied');
  }
  
  return need as { id: string; status: string; organization_id: string };
}

/**
 * Insert a need event for audit trail
 */
async function insertNeedEvent(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  params: {
    needId: string;
    organizationId: string;
    profileId: string;
    eventType: 'status_change' | 'field_update' | 'note';
    description: string;
    oldStatus?: string | null;
    newStatus?: string | null;
    note?: string | null;
  }
) {
  const insertData = {
    need_id: params.needId,
    organization_id: params.organizationId,
    created_by_profile_id: params.profileId,
    event_type: params.eventType,
    description: params.description,
    old_status: params.oldStatus || null,
    new_status: params.newStatus || null,
    note: params.note || null,
  };
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('need_events').insert(insertData);
  
  if (error) {
    console.error('Failed to insert need event:', error);
    // Don't throw - the main action succeeded
  }
}

// ============================================================================
// SERVER ACTIONS
// ============================================================================

export interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * Update the status of a Need
 */
export async function updateNeedStatus(
  needId: string,
  newStatus: NeedStatus
): Promise<ActionResult> {
  try {
    const profile = await verifyOpsAccess();
    const supabase = await createServerSupabaseClient();
    
    // Verify ownership and get current status
    const need = await verifyNeedOwnership(supabase, needId, profile.organization_id);
    const oldStatus = need.status;
    
    // Update the need status (trigger will handle urgency_light and last_status_change_at)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('needs')
      .update({ status: newStatus })
      .eq('id', needId);
    
    if (updateError) {
      throw new Error(`Failed to update status: ${updateError.message}`);
    }
    
    // Insert audit event
    await insertNeedEvent(supabase, {
      needId,
      organizationId: profile.organization_id,
      profileId: profile.id,
      eventType: 'status_change',
      description: `Status changed from ${getNeedStatusLabel(oldStatus as NeedStatus)} to ${getNeedStatusLabel(newStatus)}`,
      oldStatus,
      newStatus,
    });
    
    revalidatePath('/needs/command-center');
    revalidatePath('/needs');
    
    return { success: true };
  } catch (error) {
    console.error('updateNeedStatus error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Update the target completion date of a Need
 */
export async function updateNeedTargetDate(
  needId: string,
  newDate: string
): Promise<ActionResult> {
  try {
    const profile = await verifyOpsAccess();
    const supabase = await createServerSupabaseClient();
    
    // Verify ownership
    await verifyNeedOwnership(supabase, needId, profile.organization_id);
    
    // Update sla_target_date (trigger will recompute urgency_light)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('needs')
      .update({ sla_target_date: newDate })
      .eq('id', needId);
    
    if (updateError) {
      throw new Error(`Failed to update target date: ${updateError.message}`);
    }
    
    // Insert audit event
    await insertNeedEvent(supabase, {
      needId,
      organizationId: profile.organization_id,
      profileId: profile.id,
      eventType: 'field_update',
      description: `Target completion date updated to ${new Date(newDate).toLocaleDateString()}`,
    });
    
    revalidatePath('/needs/command-center');
    revalidatePath('/needs');
    
    return { success: true };
  } catch (error) {
    console.error('updateNeedTargetDate error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Toggle the IUA met flag on a Need
 */
export async function toggleNeedIuaMet(
  needId: string,
  nextValue: boolean
): Promise<ActionResult> {
  try {
    const profile = await verifyOpsAccess();
    const supabase = await createServerSupabaseClient();
    
    // Verify ownership
    await verifyNeedOwnership(supabase, needId, profile.organization_id);
    
    // Update iua_met
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('needs')
      .update({ iua_met: nextValue })
      .eq('id', needId);
    
    if (updateError) {
      throw new Error(`Failed to update IUA status: ${updateError.message}`);
    }
    
    // Insert audit event
    await insertNeedEvent(supabase, {
      needId,
      organizationId: profile.organization_id,
      profileId: profile.id,
      eventType: 'field_update',
      description: nextValue ? 'IUA marked as met' : 'IUA marked as not met',
    });
    
    revalidatePath('/needs/command-center');
    revalidatePath('/needs');
    
    return { success: true };
  } catch (error) {
    console.error('toggleNeedIuaMet error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Add an Ops note to a Need
 */
export async function addNeedOpsNote(
  needId: string,
  note: string
): Promise<ActionResult> {
  try {
    if (!note.trim()) {
      return { success: false, error: 'Note cannot be empty' };
    }
    
    const profile = await verifyOpsAccess();
    const supabase = await createServerSupabaseClient();
    
    // Verify ownership
    await verifyNeedOwnership(supabase, needId, profile.organization_id);
    
    // Insert note event (no need to update the need itself)
    await insertNeedEvent(supabase, {
      needId,
      organizationId: profile.organization_id,
      profileId: profile.id,
      eventType: 'note',
      description: 'Ops note added',
      note: note.trim(),
    });
    
    revalidatePath('/needs/command-center');
    revalidatePath(`/needs/${needId}`);
    
    return { success: true };
  } catch (error) {
    console.error('addNeedOpsNote error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
