import { redirect } from 'next/navigation';
import { DashboardClientShell } from '@/components/tenant/DashboardClientShell';
import { getAdminProfile } from '@/lib/profile';
import { getActiveTenant, listMyTenants } from '@/lib/tenant';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getAdminProfile();

  if (!profile) {
    redirect('/login');
  }

  if (!profile.isAdmin) {
    redirect('/access-denied');
  }

  // Resolve multi-tenancy state for the request. Falls back gracefully
  // when the org_members backfill has not run yet (single-tenant mode).
  const [activeTenant, memberships] = await Promise.all([
    getActiveTenant(),
    listMyTenants(),
  ]);

  const switcherTenants = memberships.map((m) => ({
    organizationId: m.organizationId,
    organizationName: m.organizationName,
    organizationSlug: m.organizationSlug,
    subdomain: m.subdomain,
    role: m.role,
    isDefault: m.isDefault,
    plan: m.plan,
  }));

  const activeTenantId = activeTenant?.organizationId ?? profile.organization_id;

  return (
    <DashboardClientShell
      profileId={profile.id}
      profileFullName={profile.full_name}
      profileEmail={profile.email}
      profileRole={profile.role}
      activeTenantId={activeTenantId}
      activeTenantName={activeTenant?.organizationName ?? undefined}
      activeTenantRole={activeTenant?.role ?? profile.role ?? undefined}
      memberships={memberships.map((m) => ({
        organizationId: m.organizationId,
        organizationName: m.organizationName,
        role: m.role,
      }))}
      switcherTenants={switcherTenants}
    >
      {children}
    </DashboardClientShell>
  );
}
