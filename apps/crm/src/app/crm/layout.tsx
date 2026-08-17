// All /crm/* routes are auth-protected and read cookies — force dynamic rendering
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { CrmShell } from '@/components/crm/shell';
import {
  createCrmClient,
  getCachedCurrentProfile,
  getCachedModules,
  getModules,
} from '@/lib/crm/queries';
import { resolveCrmNavProfile } from '@/lib/crm/feature-flags';
import type { NavModule } from '@/lib/crm/nav-profile';
import { ensureDefaultModules } from '@/lib/crm/seed';
import { ClientProviders } from '@/components/providers/ClientProviders';
import { getActiveTenant } from '@/lib/tenant';

export default async function CrmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Wrap all data fetching in try-catch to prevent server crash
  let profile;
  try {
    profile = await getCachedCurrentProfile();
  } catch (error) {
    console.error('[CRM Layout] Failed to get profile:', error);
    redirect('/crm-login?error=profile_fetch_failed');
  }

  if (!profile) {
    redirect('/crm-login');
  }

  // Admit users either via legacy profiles.crm_role OR via a resolved active
  // tenant from organization_members. The new RLS helpers (post-migration
  // 202605080010) honor org membership, so an admin-tier member of the
  // active org is allowed in even without a profile-side crm_role.
  const activeTenant = await getActiveTenant();
  const admittedViaTenant =
    activeTenant !== null &&
    ['owner', 'super_admin', 'admin', 'staff'].includes(activeTenant.role);

  if (!profile.crm_role && !admittedViaTenant) {
    redirect('/crm-login?error=no_crm_access');
  }

  const organizationId = profile.organization_id;
  if (
    !organizationId ||
    (typeof organizationId === 'string' && organizationId.trim() === '')
  ) {
    redirect('/crm-login?error=no_organization');
  }
  let modules: Awaited<ReturnType<typeof getCachedModules>> = [];

  try {
    modules = await getCachedModules(organizationId);
  } catch (error) {
    console.error('[CRM Layout] Failed to fetch org/modules:', error);
    // Continue with empty modules - the shell can still render
  }

  // Auto-seed modules if none exist (rare case, first login)
  let activeModules = modules || [];
  if (activeModules.length === 0) {
    try {
      await ensureDefaultModules(organizationId);
      activeModules = await getModules(organizationId);
    } catch (error) {
      console.error('[CRM Layout] Failed to auto-seed modules:', error);
      // Continue with empty modules
    }
  }

  // Tenant nav profile ('simple' for small orgs via crm.nav.simple) plus the
  // per-module field counts the nav builder uses to skip 0-field modules.
  // Both are best-effort: on failure we fall back to the full nav / unknown
  // counts (which never hide a module).
  const [navProfileResult, fieldCountsResult] = await Promise.allSettled([
    resolveCrmNavProfile(profile),
    fetchModuleFieldCounts(activeModules.map((m) => m.id)),
  ]);
  const navProfile = navProfileResult.status === 'fulfilled' ? navProfileResult.value : 'full';
  const fieldCounts = fieldCountsResult.status === 'fulfilled' ? fieldCountsResult.value : {};
  const navModules: NavModule[] = activeModules.map((m) => ({
    key: m.key,
    name: m.name,
    name_plural: m.name_plural,
    icon: m.icon,
    is_enabled: m.is_enabled,
    display_order: m.display_order,
    field_count: fieldCounts[m.id],
  }));

  return (
    <ClientProviders
      userName={profile.full_name || ''}
      userEmail={profile.email || ''}
      organizationId={organizationId}
    >
      <CrmShell
        modules={activeModules}
        profile={profile}
        navProfile={navProfile}
        navModules={navModules}
      >
        {children}
      </CrmShell>
    </ClientProviders>
  );
}

/**
 * `crm_fields` count per module id — one PostgREST embedded-count query
 * (crm_fields.module_id → crm_modules.id FK). Returns {} when there is
 * nothing to count so callers treat every count as "unknown".
 */
async function fetchModuleFieldCounts(moduleIds: string[]): Promise<Record<string, number>> {
  if (moduleIds.length === 0) return {};
  const supabase = await createCrmClient();
  const { data, error } = await supabase
    .from('crm_modules')
    .select('id, crm_fields(count)')
    .in('id', moduleIds);
  if (error) throw error;
  const out: Record<string, number> = {};
  for (const row of (data || []) as Array<{ id: string; crm_fields?: Array<{ count: number }> | null }>) {
    const count = row.crm_fields?.[0]?.count;
    if (typeof count === 'number') out[row.id] = count;
  }
  return out;
}
