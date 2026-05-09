// All /crm/* routes are auth-protected and read cookies — force dynamic rendering
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { CrmShell } from '@/components/crm/shell';
import {
  getCachedCurrentProfile,
  getCachedModules,
  getCachedOrganization,
  getModules,
} from '@/lib/crm/queries';
import { ensureDefaultModules } from '@/lib/crm/seed';
import { ClientProviders } from '@/components/providers/ClientProviders';
import { getActiveTenant, listMyTenants } from '@/lib/tenant';

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
  let organization = null;
  let modules: Awaited<ReturnType<typeof getCachedModules>> = [];
  let memberships: Awaited<ReturnType<typeof listMyTenants>> = [];

  try {
    [organization, modules, memberships] = await Promise.all([
      getCachedOrganization(organizationId),
      getCachedModules(organizationId),
      listMyTenants(),
    ]);
  } catch (error) {
    console.error('[CRM Layout] Failed to fetch org/modules/memberships:', error);
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

  return (
    <ClientProviders
      userName={profile.full_name || ''}
      userEmail={profile.email || ''}
      organizationId={organizationId}
    >
      <CrmShell
        modules={activeModules}
        profile={profile}
        organizationName={organization?.name}
        tenants={memberships}
        activeTenantId={organizationId}
      >
        {children}
      </CrmShell>
    </ClientProviders>
  );
}
