'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient, getAuthUser } from '@/lib/supabase-server';
import { setActiveTenantCookie } from '@/lib/tenant';

/**
 * Server action invoked by the CRM organization switcher. Mirrors the admin
 * app's switch-tenant action.
 *
 * Validates active membership, sets the dh_active_org cookie, busts the
 * middleware's profile cache (because that cache is HMAC-signed and the
 * client can't clear it — only the server can), and revalidates the layout.
 */
export async function switchTenant(organizationId: string) {
  if (!organizationId || typeof organizationId !== 'string') {
    throw new Error('switchTenant: invalid organizationId');
  }

  const { user } = await getAuthUser();
  if (!user) redirect('/crm-login');

  const supabase = await createClient();

  const db = supabase as any;
  const { data: membership, error } = (await db
    .from('organization_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .maybeSingle()) as { data: { id: string } | null; error: unknown };

  if (error || !membership) {
    throw new Error('switchTenant: you are not an active member of this organization.');
  }

  await setActiveTenantCookie(organizationId);

  // Bust the middleware's signed profile cache so it doesn't keep gating
  // routes against the previous tenant for up to 5 minutes.
  const cookieStore = await cookies();
  cookieStore.delete('crm_profile_cache');

  await db
    .from('organization_members')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', membership.id);

  revalidatePath('/', 'layout');
}
