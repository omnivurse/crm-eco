// All /crm/* routes are auth-protected and read cookies — force dynamic rendering
export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { CrmShell } from '@/components/crm/shell';
import { CrmShellSkeleton } from '@/components/crm/shell/CrmShellSkeleton';
import { ClientProviders } from '@/components/providers/ClientProviders';
import { loadCrmSession } from '@/lib/crm/load-crm-session';

async function CrmAuthedShell({ children }: { children: React.ReactNode }) {
  const session = await loadCrmSession();

  return (
    <ClientProviders
      userName={session.profile.full_name || ''}
      userEmail={session.profile.email || ''}
      organizationId={session.organizationId}
    >
      <CrmShell
        modules={session.modules}
        profile={session.profile}
        navProfile={session.navProfile}
        navModules={session.navModules}
      >
        {children}
      </CrmShell>
    </ClientProviders>
  );
}

/**
 * Sync layout so the first HTML byte can be the shell skeleton. The authed
 * chrome still has to resolve (cookies + RLS), but the user sees structure
 * immediately instead of a blank document.
 */
export default function CrmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<CrmShellSkeleton />}>
      <CrmAuthedShell>{children}</CrmAuthedShell>
    </Suspense>
  );
}
