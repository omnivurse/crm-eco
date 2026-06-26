import { ReactNode } from 'react';
import { requireActiveMembership } from '@/lib/auth/require-active-membership';

/**
 * (member) route group layout.
 *
 * Gates every page in this group on:
 *   - authenticated user (via Supabase Auth)
 *   - resolvable member record (via getMemberForUser)
 *   - any membership row (active/paused/etc.)
 *
 * Pages here render inside the existing PortalHeader/BottomNav from the root
 * layout — this layout adds no extra chrome, only the gate.
 */
export default async function MemberLayout({ children }: { children: ReactNode }) {
  await requireActiveMembership();
  return <>{children}</>;
}
