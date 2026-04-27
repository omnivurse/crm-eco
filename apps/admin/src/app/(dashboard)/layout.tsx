import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/layout/AdminShell';
import { AdminNotificationListener } from '@/components/notifications/AdminNotificationListener';
import { TerminalWrapper } from '@/components/terminal/TerminalWrapper';
import { TenantProvider } from '@/components/tenant/TenantContext';
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
    <TenantProvider
      organizationId={activeTenantId}
      organizationName={activeTenant?.organizationName ?? undefined}
      role={activeTenant?.role ?? profile.role ?? undefined}
      tenants={memberships.map((m) => ({
        organizationId: m.organizationId,
        organizationName: m.organizationName,
        role: m.role,
      }))}
    >
      <TerminalWrapper
        profile={{
          id: profile.id,
          role: profile.role || undefined,
          full_name: profile.full_name || undefined,
          organization_id: activeTenantId || undefined,
        }}
      >
        <AdminShell
          profile={{
            fullName: profile.full_name || '',
            email: profile.email,
            avatarUrl: null,
            role: profile.role || '',
            organizationId: activeTenantId,
          }}
          userId={profile.id}
          tenants={switcherTenants}
          activeTenantId={activeTenantId}
        >
          <AdminNotificationListener userId={profile.id} />
          {children}
        </AdminShell>
      </TerminalWrapper>
    </TenantProvider>
  );
}
