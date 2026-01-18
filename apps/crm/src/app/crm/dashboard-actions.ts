'use server';

import { revalidatePath } from 'next/cache';
import { createCrmClient, getCurrentProfile } from '@/lib/crm/queries';
import type { DashboardLayoutConfig } from '@/lib/dashboard/types';
import { DEFAULT_LAYOUT } from '@/lib/dashboard/widget-registry';

const DASHBOARD_CONTEXT = 'crm_dashboard';

export interface DashboardActionResult {
  success: boolean;
  error?: string;
  data?: DashboardLayoutConfig;
}

/**
 * Load the user's saved dashboard layout
 */
export async function loadDashboardLayout(): Promise<DashboardLayoutConfig | null> {
  try {
    const profile = await getCurrentProfile();
    if (!profile) return null;

    const supabase = await createCrmClient();

    const { data: view, error } = await supabase
      .from('saved_views')
      .select('filters')
      .eq('owner_profile_id', profile.id)
      .eq('context', DASHBOARD_CONTEXT)
      .eq('is_default', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error loading dashboard layout:', error);
      return null;
    }

    if (view?.filters) {
      return view.filters as DashboardLayoutConfig;
    }

    return null;
  } catch (error) {
    console.error('loadDashboardLayout error:', error);
    return null;
  }
}

/**
 * Save the user's dashboard layout
 */
export async function saveDashboardLayout(
  layout: DashboardLayoutConfig
): Promise<DashboardActionResult> {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return { success: false, error: 'Not authenticated' };
    }

    const supabase = await createCrmClient();

    // Check if a layout already exists
    const { data: existing } = await supabase
      .from('saved_views')
      .select('id')
      .eq('owner_profile_id', profile.id)
      .eq('context', DASHBOARD_CONTEXT)
      .eq('is_default', true)
      .single();

    if (existing) {
      // Update existing layout
      const { error } = await supabase
        .from('saved_views')
        .update({ filters: layout })
        .eq('id', existing.id);

      if (error) throw error;
    } else {
      // Create new layout
      const { error } = await supabase.from('saved_views').insert({
        organization_id: profile.organization_id,
        owner_profile_id: profile.id,
        context: DASHBOARD_CONTEXT,
        name: 'My Dashboard',
        filters: layout,
        is_default: true,
      });

      if (error) throw error;
    }

    revalidatePath('/crm');
    return { success: true, data: layout };
  } catch (error) {
    console.error('saveDashboardLayout error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Reset dashboard to default layout
 */
export async function resetDashboardLayout(): Promise<DashboardActionResult> {
  return saveDashboardLayout(DEFAULT_LAYOUT);
}
