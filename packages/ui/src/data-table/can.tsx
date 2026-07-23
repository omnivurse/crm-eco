'use client';

import * as React from 'react';

/**
 * Permission seam for Candidate 3.
 * Until the unified permission gate lands, useCan() always returns true.
 * Apps wrap with CanProvider({ can }) to inject real checks later —
 * ResourceList row/bulk actions with `permission` keys pick this up automatically.
 */
export type CanFn = (permission: string) => boolean;

const CanContext = React.createContext<CanFn>(() => true);

export function CanProvider({
  can,
  children,
}: {
  can: CanFn;
  children: React.ReactNode;
}) {
  return <CanContext.Provider value={can}>{children}</CanContext.Provider>;
}

export function useCan(permission?: string): boolean {
  const can = React.useContext(CanContext);
  if (!permission) return true;
  return can(permission);
}
