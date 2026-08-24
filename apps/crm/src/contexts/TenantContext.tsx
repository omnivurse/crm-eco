'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';

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
  // The org id never changes for the life of the tree, but `{ organizationId }`
  // is a fresh object on every render — and this provider sits ABOVE the
  // page-level `<Suspense>` boundaries (`/crm/modules/[moduleKey]`,
  // `/crm/r/[recordId]`, `/crm/pipeline`). While one of those is still
  // dehydrated, React checks whether any ancestor context changed, and a new
  // value makes it throw the server HTML away and client-render the page.
  // Measured on a production build: with the literal, 12/12 cold loads of a
  // record page discarded their server markup (`useId` fell to the client-only
  // `_r_<n>` namespace); memoised, 0/12. Same defect as the CRM shell's
  // ThemeProvider — see components/providers/theme-store.ts.
  const value = useMemo(() => ({ organizationId }), [organizationId]);
  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

/** Tenant org from CRM layout — use for extra client-side filters alongside RLS. */
export function useTenantOrganizationId(): string | null {
  return useContext(TenantContext)?.organizationId ?? null;
}
