import { redirect } from 'next/navigation';
import { CrmShell } from '@/components/crm/shell';
import {
  getCachedCurrentProfile,
  getCachedModules,
  getCachedOrganization,
  getModules,
} from '@/lib/crm/queries';
import { ensureDefaultModules } from '@/lib/crm/seed';
import { Toaster } from '@/components/ui/sonner';
import { SecurityProvider } from '@/providers/SecurityProvider';

export const dynamic = 'force-dynamic';

export default async function CrmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Use cached profile - deduplicates requests within same render
  const profile = await getCachedCurrentProfile();

  if (!profile) {
    redirect('/crm-login');
  }

  if (!profile.crm_role) {
    redirect('/crm-login?error=no_crm_access');
  }

  // Fetch organization and modules in parallel with caching
  const [organization, modules] = await Promise.all([
    getCachedOrganization(profile.organization_id),
    getCachedModules(profile.organization_id),
  ]);

  // Auto-seed modules if none exist (rare case, first login)
  let activeModules = modules;
  if (activeModules.length === 0) {
    try {
      await ensureDefaultModules(profile.organization_id);
      activeModules = await getModules(profile.organization_id);
    } catch (error) {
      console.error('Failed to auto-seed modules:', error);
    }
  }

  return (
    <SecurityProvider
      userName={profile.full_name || ''}
      userEmail={profile.email || ''}
    >
      <CrmShell
        modules={activeModules}
        profile={profile}
        organizationName={organization?.name}
      >
        {children}
      </CrmShell>
      <Toaster />
    </SecurityProvider>
  );
}
