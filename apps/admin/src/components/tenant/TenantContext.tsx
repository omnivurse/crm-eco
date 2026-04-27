'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';

/**
 * Active-tenant context for client components.
 * ----------------------------------------------------------------
 * The Admin app is multi-tenant. The *server* resolves the active
 * tenant for a request via the cookie / subdomain / membership
 * resolution chain in `apps/admin/src/lib/tenant.ts`, then this
 * provider hydrates that decision into the client tree so that
 * `'use client'` components no longer need to round-trip to Supabase
 * just to learn their `organization_id`.
 *
 * Client components MUST use `useActiveOrgId()` instead of looking
 * up `profiles.organization_id` themselves — looking it up at the
 * client would always return the user's *primary* tenant and would
 * silently break tenant switching.
 */
export interface ActiveTenantValue {
  organizationId: string;
  organizationName?: string;
  role?: string;
  /** Map of every tenant the user belongs to (id → name). */
  tenants: Record<string, { name: string; role?: string }>;
}

const TenantContext = createContext<ActiveTenantValue | null>(null);

export interface TenantProviderProps {
  organizationId: string;
  organizationName?: string;
  role?: string;
  tenants?: Array<{ organizationId: string; organizationName: string; role?: string }>;
  children: ReactNode;
}

export function TenantProvider({
  organizationId,
  organizationName,
  role,
  tenants,
  children,
}: TenantProviderProps) {
  const value = useMemo<ActiveTenantValue>(
    () => ({
      organizationId,
      organizationName,
      role,
      tenants: Object.fromEntries(
        (tenants ?? []).map((t) => [
          t.organizationId,
          { name: t.organizationName, role: t.role },
        ]),
      ),
    }),
    [organizationId, organizationName, role, tenants],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

/**
 * Read the active tenant. Throws if used outside the provider —
 * fails fast so misuse is obvious in development.
 */
export function useActiveTenant(): ActiveTenantValue {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error(
      'useActiveTenant must be used inside <TenantProvider> (admin dashboard layout).',
    );
  }
  return ctx;
}

/**
 * Convenience accessor — returns just the active organization id.
 * This is what most client components actually need.
 */
export function useActiveOrgId(): string {
  return useActiveTenant().organizationId;
}
