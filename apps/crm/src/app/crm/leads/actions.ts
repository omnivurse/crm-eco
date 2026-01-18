'use server';

import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import {
  type LeadsBoardSavedFilters,
  LEADS_BOARD_CONTEXT,
} from '@crm-eco/lib';

// Roles that can use saved views for leads
const ALLOWED_ROLES = ['owner', 'admin', 'staff', 'advisor'];

/**
 * Verify the current user can access saved views
 */
async function verifyAccess() {
  const profile = await getCurrentProfile();

  if (!profile) {
    throw new Error('Not authenticated');
  }

  if (!ALLOWED_ROLES.includes(profile.role)) {
    throw new Error('Not authorized');
  }

  return profile;
}

// ============================================================================
// SERVER ACTIONS
// ============================================================================

export interface ActionResult {
  success: boolean;
  error?: string;
  viewId?: string;
}

/**
 * Create a new saved view for the Leads Board
 */
export async function createLeadsSavedView(params: {
  name: string;
  filters: LeadsBoardSavedFilters;
  setAsDefault?: boolean;
}): Promise<ActionResult> {
  try {
    if (!params.name.trim()) {
      return { success: false, error: 'View name is required' };
    }

    const profile = await verifyAccess();
    const supabase = await createServerSupabaseClient();

    // If setting as default, first clear other defaults for this user/context
    if (params.setAsDefault) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('saved_views')
        .update({ is_default: false })
        .eq('owner_profile_id', profile.id)
        .eq('context', LEADS_BOARD_CONTEXT);
    }

    // Insert the new view
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('saved_views')
      .insert({
        organization_id: profile.organization_id,
        owner_profile_id: profile.id,
        context: LEADS_BOARD_CONTEXT,
        name: params.name.trim(),
        filters: params.filters,
        is_default: params.setAsDefault ?? false,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create saved view: ${error.message}`);
    }

    revalidatePath('/leads');
    return { success: true, viewId: data?.id };
  } catch (error) {
    console.error('createLeadsSavedView error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Set a saved view as the default for the Leads Board
 */
export async function setLeadsSavedViewDefault(viewId: string): Promise<ActionResult> {
  try {
    const profile = await verifyAccess();
    const supabase = await createServerSupabaseClient();

    // Verify the view belongs to this user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: view, error: viewError } = await (supabase as any)
      .from('saved_views')
      .select('id')
      .eq('id', viewId)
      .eq('owner_profile_id', profile.id)
      .eq('context', LEADS_BOARD_CONTEXT)
      .single();

    if (viewError || !view) {
      throw new Error('Saved view not found or access denied');
    }

    // Clear other defaults for this user/context
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('saved_views')
      .update({ is_default: false })
      .eq('owner_profile_id', profile.id)
      .eq('context', LEADS_BOARD_CONTEXT);

    // Set this one as default
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('saved_views')
      .update({ is_default: true })
      .eq('id', viewId);

    if (updateError) {
      throw new Error(`Failed to set default view: ${updateError.message}`);
    }

    revalidatePath('/leads');
    return { success: true };
  } catch (error) {
    console.error('setLeadsSavedViewDefault error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Clear the default view for the Leads Board
 */
export async function clearLeadsSavedViewDefault(): Promise<ActionResult> {
  try {
    const profile = await verifyAccess();
    const supabase = await createServerSupabaseClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('saved_views')
      .update({ is_default: false })
      .eq('owner_profile_id', profile.id)
      .eq('context', LEADS_BOARD_CONTEXT);

    revalidatePath('/leads');
    return { success: true };
  } catch (error) {
    console.error('clearLeadsSavedViewDefault error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete a saved view for the Leads Board
 */
export async function deleteLeadsSavedView(viewId: string): Promise<ActionResult> {
  try {
    const profile = await verifyAccess();
    const supabase = await createServerSupabaseClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('saved_views')
      .delete()
      .eq('id', viewId)
      .eq('owner_profile_id', profile.id)
      .eq('context', LEADS_BOARD_CONTEXT);

    if (error) {
      throw new Error(`Failed to delete saved view: ${error.message}`);
    }

    revalidatePath('/leads');
    return { success: true };
  } catch (error) {
    console.error('deleteLeadsSavedView error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

