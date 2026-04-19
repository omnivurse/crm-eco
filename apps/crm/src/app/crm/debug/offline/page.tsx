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

export const dynamic = 'force-dynamic';

export default function OfflineDebugPage() {
  return <OfflineDebugClient />;
}
