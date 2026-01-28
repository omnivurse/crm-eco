'use server';

import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import {
  getNeedStatusLabel,
  type NeedStatus,
  type NeedsCommandCenterSavedFilters,
  NEEDS_COMMAND_CENTER_CONTEXT,
} from '@crm-eco/lib';

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

/**
 * Assign a Need to the current user (Ops only)
 */
export async function assignNeedToMe(needId: string): Promise<ActionResult> {
  try {
    const profile = await verifyOpsAccess();
    const supabase = await createServerSupabaseClient();
    
    // Verify ownership
    await verifyNeedOwnership(supabase, needId, profile.organization_id);
    
    // Update assignee to current user
    const { error: updateError } = await (supabase as any)
      .from('needs')
      .update({ assigned_to_profile_id: profile.id })
      .eq('id', needId);
    
    if (updateError) {
      throw new Error(`Failed to assign need: ${updateError.message}`);
    }
    
    // Insert audit event
    await insertNeedEvent(supabase, {
      needId,
      organizationId: profile.organization_id,
      profileId: profile.id,
      eventType: 'field_update',
      description: `Assigned to ${profile.full_name}`,
    });
    
    revalidatePath('/needs/command-center');
    revalidatePath('/needs');
    
    return { success: true };
  } catch (error) {
    console.error('assignNeedToMe error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Assign a Need to a specific Ops user
 */
export async function assignNeedToProfile(
  needId: string,
  assigneeProfileId: string
): Promise<ActionResult> {
  try {
    const profile = await verifyOpsAccess();
    const supabase = await createServerSupabaseClient();
    
    // Verify need ownership
    await verifyNeedOwnership(supabase, needId, profile.organization_id);
    
    // Verify assignee is a valid Ops profile in the same org
    const { data: assignee, error: assigneeError } = await (supabase as any)
      .from('profiles')
      .select('id, full_name, role, organization_id')
      .eq('id', assigneeProfileId)
      .single();
    
    if (assigneeError || !assignee) {
      throw new Error('Assignee not found');
    }
    
    if (assignee.organization_id !== profile.organization_id) {
      throw new Error('Cross-org assignment not allowed');
    }
    
    if (!OPS_ROLES.includes(assignee.role)) {
      throw new Error('Assignee must be an Ops role (owner, admin, or staff)');
    }
    
    // Update assignee
    const { error: updateError } = await (supabase as any)
      .from('needs')
      .update({ assigned_to_profile_id: assignee.id })
      .eq('id', needId);
    
    if (updateError) {
      throw new Error(`Failed to assign need: ${updateError.message}`);
    }
    
    // Insert audit event
    await insertNeedEvent(supabase, {
      needId,
      organizationId: profile.organization_id,
      profileId: profile.id,
      eventType: 'field_update',
      description: `Assigned to ${assignee.full_name}`,
    });
    
    revalidatePath('/needs/command-center');
    revalidatePath('/needs');
    
    return { success: true };
  } catch (error) {
    console.error('assignNeedToProfile error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// ============================================================================
// SAVED VIEWS ACTIONS
// ============================================================================

export interface SavedViewResult {
  success: boolean;
  error?: string;
  viewId?: string;
}

/**
 * Create a new saved view for the current user in the Needs Command Center
 */
export async function createNeedsSavedView(params: {
  name: string;
  filters: NeedsCommandCenterSavedFilters;
  setAsDefault?: boolean;
}): Promise<SavedViewResult> {
  try {
    if (!params.name.trim()) {
      return { success: false, error: 'View name is required' };
    }

    const profile = await verifyOpsAccess();
    const supabase = await createServerSupabaseClient();

    // If setting as default, first clear other defaults for this user/context
    if (params.setAsDefault) {
      await (supabase as any)
        .from('saved_views')
        .update({ is_default: false })
        .eq('owner_profile_id', profile.id)
        .eq('context', NEEDS_COMMAND_CENTER_CONTEXT);
    }

    // Insert the new view
    const { data, error } = await (supabase as any)
      .from('saved_views')
      .insert({
        organization_id: profile.organization_id,
        owner_profile_id: profile.id,
        context: NEEDS_COMMAND_CENTER_CONTEXT,
        name: params.name.trim(),
        filters: params.filters,
        is_default: params.setAsDefault ?? false,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create saved view: ${error.message}`);
    }

    revalidatePath('/needs/command-center');
    return { success: true, viewId: data?.id };
  } catch (error) {
    console.error('createNeedsSavedView error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Set a saved view as the default for the current user
 */
export async function setNeedsSavedViewDefault(viewId: string): Promise<ActionResult> {
  try {
    const profile = await verifyOpsAccess();
    const supabase = await createServerSupabaseClient();

    // First, verify the view belongs to this user
    const { data: view, error: viewError } = await (supabase as any)
      .from('saved_views')
      .select('id')
      .eq('id', viewId)
      .eq('owner_profile_id', profile.id)
      .eq('context', NEEDS_COMMAND_CENTER_CONTEXT)
      .single();

    if (viewError || !view) {
      throw new Error('Saved view not found or access denied');
    }

    // Clear other defaults for this user/context
    await (supabase as any)
      .from('saved_views')
      .update({ is_default: false })
      .eq('owner_profile_id', profile.id)
      .eq('context', NEEDS_COMMAND_CENTER_CONTEXT);

    // Set this one as default
    const { error: updateError } = await (supabase as any)
      .from('saved_views')
      .update({ is_default: true })
      .eq('id', viewId);

    if (updateError) {
      throw new Error(`Failed to set default view: ${updateError.message}`);
    }

    revalidatePath('/needs/command-center');
    return { success: true };
  } catch (error) {
    console.error('setNeedsSavedViewDefault error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Clear the default view for the current user (no view will load by default)
 */
export async function clearNeedsSavedViewDefault(): Promise<ActionResult> {
  try {
    const profile = await verifyOpsAccess();
    const supabase = await createServerSupabaseClient();

    // Clear all defaults for this user/context
    await (supabase as any)
      .from('saved_views')
      .update({ is_default: false })
      .eq('owner_profile_id', profile.id)
      .eq('context', NEEDS_COMMAND_CENTER_CONTEXT);

    revalidatePath('/needs/command-center');
    return { success: true };
  } catch (error) {
    console.error('clearNeedsSavedViewDefault error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete a saved view owned by the current user
 */
export async function deleteNeedsSavedView(viewId: string): Promise<ActionResult> {
  try {
    const profile = await verifyOpsAccess();
    const supabase = await createServerSupabaseClient();

    // Delete the view (RLS will enforce ownership, but we double-check)
    const { error } = await (supabase as any)
      .from('saved_views')
      .delete()
      .eq('id', viewId)
      .eq('owner_profile_id', profile.id)
      .eq('context', NEEDS_COMMAND_CENTER_CONTEXT);

    if (error) {
      throw new Error(`Failed to delete saved view: ${error.message}`);
    }

    revalidatePath('/needs/command-center');
    return { success: true };
  } catch (error) {
    console.error('deleteNeedsSavedView error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update an existing saved view's filters (optionally rename it)
 */
export async function updateNeedsSavedView(params: {
  viewId: string;
  name?: string;
  filters?: NeedsCommandCenterSavedFilters;
}): Promise<ActionResult> {
  try {
    const profile = await verifyOpsAccess();
    const supabase = await createServerSupabaseClient();

    // Verify ownership
    const { data: view, error: viewError } = await (supabase as any)
      .from('saved_views')
      .select('id')
      .eq('id', params.viewId)
      .eq('owner_profile_id', profile.id)
      .eq('context', NEEDS_COMMAND_CENTER_CONTEXT)
      .single();

    if (viewError || !view) {
      throw new Error('Saved view not found or access denied');
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = {};
    if (params.name !== undefined) {
      updatePayload.name = params.name.trim();
    }
    if (params.filters !== undefined) {
      updatePayload.filters = params.filters;
    }

    if (Object.keys(updatePayload).length === 0) {
      return { success: true }; // Nothing to update
    }

    const { error: updateError } = await (supabase as any)
      .from('saved_views')
      .update(updatePayload)
      .eq('id', params.viewId);

    if (updateError) {
      throw new Error(`Failed to update saved view: ${updateError.message}`);
    }

    revalidatePath('/needs/command-center');
    return { success: true };
  } catch (error) {
    console.error('updateNeedsSavedView error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
