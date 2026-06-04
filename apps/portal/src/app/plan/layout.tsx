import { ReactNode } from 'react';
import { requireActiveMembership } from '@/lib/auth/require-active-membership';

/**
 * Gates all /plan pages (overview, change, cancel) on an authenticated user with
 * a resolvable member record and a membership row, redirecting non-members to
 * /access-denied?reason=no_member — consistent with the (member) route group.
 * Adds no chrome; PortalHeader/BottomNav come from the root layout.
 */
export default async function PlanLayout({ children }: { children: ReactNode }) {
  await requireActiveMembership();
  return <>{children}</>;
}
