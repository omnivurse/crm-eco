/**
 * /crm/debug/offline — inspector for the client-side offline stack.
 *
 * Dumps the mutation queue, response cache, and recent-records index
 * as JSON. Intended for support triage and engineering diagnostics —
 * not part of the user-facing product surface.
 *
 * Protection: /crm/* is already auth-gated by `crm/layout.tsx`, which
 * redirects unauthenticated users to `/crm-login`. Wrapping the debug
 * page in the CRM shell is intentional so the banner + topbar remain
 * available for navigation.
 */

import OfflineDebugClient from './OfflineDebugClient';
import { getCurrentProfile } from '@/lib/crm/queries';

export const dynamic = 'force-dynamic';

export default async function OfflineDebugPage() {
  /* Pass the org id down so the client component can open a
   * Supabase Realtime subscription scoped to this tenant. Without
   * it, cross-device receipts would need to poll the reconciliation
   * endpoint — which is exactly what realtime is meant to avoid. */
  const profile = await getCurrentProfile();
  return (
    <OfflineDebugClient organizationId={profile?.organization_id ?? null} />
  );
}
