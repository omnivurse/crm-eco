'use client';

import { SecurityProvider } from '@/providers/SecurityProvider';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { Toaster } from '@/components/ui/sonner';
import { useTheme } from '@/components/providers/theme-provider';
import { TenantProvider } from '@/contexts/TenantContext';

interface ClientProvidersProps {
  children: React.ReactNode;
  userName?: string;
  userEmail?: string;
  /**
   * When set (CRM layout), exposes `useTenantOrganizationId()` for client queries.
   * Same value as `profiles.organization_id` — use with `crm_*`.`org_id`.
   */
  organizationId?: string;
}

export function ClientProviders({
  children,
  userName,
  userEmail,
  organizationId,
}: ClientProvidersProps) {
  // FB-M1: toasts follow the CRM theme. ThemeProvider (RootProviders, the root
  // layout) resolves `system` to the live light/dark value, so sonner gets a
  // concrete theme and re-paints when the operator flips the switch.
  const { resolvedTheme } = useTheme();
  const tree = (
    <SecurityProvider userName={userName} userEmail={userEmail}>
      <QueryProvider>
        {children}
        <Toaster theme={resolvedTheme} />
      </QueryProvider>
    </SecurityProvider>
  );

  if (organizationId) {
    return <TenantProvider organizationId={organizationId}>{tree}</TenantProvider>;
  }

  return tree;
}
