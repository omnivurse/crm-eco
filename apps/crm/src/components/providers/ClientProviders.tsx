'use client';

import { SecurityProvider } from '@/providers/SecurityProvider';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { Toaster } from '@/components/ui/sonner';
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
  const tree = (
    <SecurityProvider userName={userName} userEmail={userEmail}>
      <QueryProvider>
        {children}
        <Toaster />
      </QueryProvider>
    </SecurityProvider>
  );

  if (organizationId) {
    return <TenantProvider organizationId={organizationId}>{tree}</TenantProvider>;
  }

  return tree;
}
