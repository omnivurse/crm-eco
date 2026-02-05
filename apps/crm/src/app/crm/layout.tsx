import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { CrmShell } from '@/components/crm/shell';
import {
  getCachedCurrentProfile,
  getCachedModules,
  getCachedOrganization,
  getModules,
} from '@/lib/crm/queries';
import { ensureDefaultModules } from '@/lib/crm/seed';
import { SecurityProvider } from '@/providers/SecurityProvider';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { Toaster } from '@/components/ui/sonner';

export const dynamic = 'force-dynamic';

export default async function CrmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Wrap all data fetching in try-catch to prevent server crash
  let profile;
  try {
    profile = await getCachedCurrentProfile();
  } catch (error) {
    console.error('[CRM Layout] Failed to get profile:', error);
    redirect('/crm-login?error=profile_fetch_failed');
  }

  if (!profile) {
    redirect('/crm-login');
  }

  if (!profile.crm_role) {
    redirect('/crm-login?error=no_crm_access');
  }

  // Fetch organization and modules in parallel with caching
  let organization = null;
  let modules: Awaited<ReturnType<typeof getCachedModules>> = [];
  
  try {
    [organization, modules] = await Promise.all([
      getCachedOrganization(profile.organization_id),
      getCachedModules(profile.organization_id),
    ]);
  } catch (error) {
    console.error('[CRM Layout] Failed to fetch org/modules:', error);
    // Continue with empty modules - the shell can still render
  }

  // Auto-seed modules if none exist (rare case, first login)
  let activeModules = modules || [];
  if (activeModules.length === 0) {
    try {
      await ensureDefaultModules(profile.organization_id);
      activeModules = await getModules(profile.organization_id);
    } catch (error) {
      console.error('[CRM Layout] Failed to auto-seed modules:', error);
      // Continue with empty modules
    }
  }

  return (
    <SecurityProvider
      userName={profile.full_name || ''}
      userEmail={profile.email || ''}
    >
      <QueryProvider>
        <CrmShell
          modules={activeModules}
          profile={profile}
          organizationName={organization?.name}
        >
          {children}
        </CrmShell>
        <Suspense fallback={null}>
          <Toaster />
        </Suspense>
      </QueryProvider>
    </SecurityProvider>
  );
}
