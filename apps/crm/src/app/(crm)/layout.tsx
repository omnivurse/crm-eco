import { redirect } from 'next/navigation';
import { CrmShell } from '@/components/crm/shell';
import { getCurrentProfile, getModules } from '@/lib/crm/queries';
import { createCrmClient } from '@/lib/crm/queries';

export default async function CrmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect('/crm-login');
  }

  if (!profile.crm_role) {
    redirect('/crm-login?error=no_crm_access');
  }

  // Get organization info
  const supabase = await createCrmClient();
  const { data: organization } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .eq('id', profile.organization_id)
    .single();

  // Get enabled modules
  const modules = await getModules(profile.organization_id);

  return (
    <CrmShell
      modules={modules}
      profile={profile}
      organizationName={organization?.name}
    >
      {children}
    </CrmShell>
  );
}
