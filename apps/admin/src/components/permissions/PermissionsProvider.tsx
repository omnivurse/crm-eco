'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CanProvider } from '@crm-eco/ui';
import { permissionsFromOrgRole } from '@crm-eco/lib/permissions';

type Props = {
  /** Active tenant role — seeds CanProvider synchronously (bridge). */
  role: string | null | undefined;
  /** Re-fetch when the active org changes. */
  organizationId: string;
  children: ReactNode;
};

/**
 * Wraps the admin shell in CanProvider.
 * 1) Immediately seeds from the org-role bridge (no flicker for owners/admins).
 * 2) Refreshes from GET /api/permissions/me (RPC-backed when migration applied).
 */
export function PermissionsProvider({ role, organizationId, children }: Props) {
  const bridgeKeys = useMemo(() => permissionsFromOrgRole(role), [role]);
  const [keys, setKeys] = useState<Set<string>>(() => new Set(bridgeKeys));

  useEffect(() => {
    setKeys(new Set(permissionsFromOrgRole(role)));
  }, [role, organizationId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/permissions/me', { credentials: 'same-origin' });
        if (!res.ok) return;
        const body = (await res.json()) as { permissions?: string[] };
        if (cancelled || !Array.isArray(body.permissions)) return;
        setKeys(new Set(body.permissions));
      } catch {
        /* keep bridge set */
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const can = useCallback((permission: string) => keys.has(permission), [keys]);

  return <CanProvider can={can}>{children}</CanProvider>;
}
