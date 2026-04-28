'use client';

import { createContext, useContext, type ReactNode } from 'react';

export interface TenantContextValue {
  /** Same UUID as `profiles.organization_id` — use for `.eq('org_id', …)` on `crm_*` tables. */
  organizationId: string;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({
  organizationId,
  children,
}: {
  organizationId: string;
  children: ReactNode;
}) {
  return (
    <TenantContext.Provider value={{ organizationId }}>
      {children}
    </TenantContext.Provider>
  );
}

/** Tenant org from CRM layout — use for extra client-side filters alongside RLS. */
export function useTenantOrganizationId(): string | null {
  return useContext(TenantContext)?.organizationId ?? null;
}
