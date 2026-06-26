import { ReactNode } from 'react';
import { requireActiveMembership } from '@/lib/auth/require-active-membership';

/**
 * Gates all /needs pages (list, submit, detail) on an authenticated user with a
 * resolvable member record and a membership row, redirecting non-members to
 * /access-denied?reason=no_member — consistent with the (member) route group
 * and /plan. Adds no chrome; PortalHeader/BottomNav come from the root layout.
 */
export default async function NeedsLayout({ children }: { children: ReactNode }) {
  await requireActiveMembership();
  return <>{children}</>;
}
