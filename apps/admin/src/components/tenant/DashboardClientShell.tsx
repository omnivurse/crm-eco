'use client';

import type { ReactNode } from 'react';
import { TenantProvider } from '@/components/tenant/TenantContext';
import { AdminShell } from '@/components/layout/AdminShell';
import { AdminNotificationListener } from '@/components/notifications/AdminNotificationListener';
import { PermissionsProvider } from '@/components/permissions/PermissionsProvider';
import { TerminalWrapper } from '@/components/terminal/TerminalWrapper';
import type { SwitcherTenant } from '@/components/layout/OrganizationSwitcher';

interface MembershipTenant {
  organizationId: string;
  organizationName: string;
  role?: string;
}

interface DashboardClientShellProps {
  children: ReactNode;
  profileId: string;
  profileFullName: string | null;
  profileEmail: string;
  profileRole: string | null;
  activeTenantId: string;
  activeTenantName?: string;
  activeTenantRole?: string;
  memberships: MembershipTenant[];
  switcherTenants: SwitcherTenant[];
}

export function DashboardClientShell({
  children,
  profileId,
  profileFullName,
  profileEmail,
  profileRole,
  activeTenantId,
  activeTenantName,
  activeTenantRole,
  memberships,
  switcherTenants,
}: DashboardClientShellProps) {
  return (
    <TenantProvider
      organizationId={activeTenantId}
      organizationName={activeTenantName}
      role={activeTenantRole}
      tenants={memberships}
    >
      <TerminalWrapper
        profile={{
          id: profileId,
          role: profileRole || undefined,
          full_name: profileFullName || undefined,
          organization_id: activeTenantId || undefined,
        }}
      >
        <PermissionsProvider
          role={activeTenantRole || profileRole}
          organizationId={activeTenantId}
        >
          <AdminShell
            profile={{
              fullName: profileFullName || '',
              email: profileEmail,
              avatarUrl: null,
              role: profileRole || '',
              organizationId: activeTenantId,
            }}
            userId={profileId}
            tenants={switcherTenants}
            activeTenantId={activeTenantId}
          >
            <AdminNotificationListener userId={profileId} />
            {children}
          </AdminShell>
        </PermissionsProvider>
      </TerminalWrapper>
    </TenantProvider>
  );
}
