'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { setActiveTenantCookie } from '@/lib/tenant';

/**
 * Server action invoked by the OrganizationSwitcher dropdown.
 *
 * Validates that the requesting user is an active member of the target
 * organization (defence in depth — RLS already protects, but we never
 * rely on a single layer), persists the choice in a cookie, and
 * revalidates so server components re-resolve their tenant.
 */
export async function switchTenant(organizationId: string) {
  if (!organizationId || typeof organizationId !== 'string') {
    throw new Error('switchTenant: invalid organizationId');
  }

  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Defence-in-depth membership check
  const { data: membership, error } = await supabase
    .from('organization_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !membership) {
    throw new Error('switchTenant: you are not an active member of this organization.');
  }

  await setActiveTenantCookie(organizationId);

  // Update last_active_at so the switcher can sort by recency
  await supabase
    .from('organization_members')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', membership.id);

  revalidatePath('/', 'layout');
}
