import { redirect } from 'next/navigation';
import { getCachedCurrentProfile, getCachedModules } from '@/lib/crm/queries';
import { UpdateImportClient } from './UpdateImportClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ module?: string }>;
}

/**
 * /crm/imports/update — server page that gates by CRM admin/manager role
 * and feeds the client a tenant-scoped list of modules to pick from.
 */
export default async function UpdateImportPage({ searchParams }: PageProps) {
  const profile = await getCachedCurrentProfile();
  if (!profile) redirect('/crm-login');
  if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
    redirect('/crm?error=insufficient_permissions');
  }

  const { module: defaultModuleKey } = await searchParams;

  const modules = await getCachedModules(profile.organization_id);

  // Only modules that store record-style data (have records). The pre-seeded
  // empty modules can still be selected, but they're sorted last so the most
  // useful options surface first.
  const sorted = [...modules].sort((a, b) => {
    const orderA = (a as { display_order?: number }).display_order ?? 999;
    const orderB = (b as { display_order?: number }).display_order ?? 999;
    return orderA - orderB;
  });

  return (
    <UpdateImportClient
      modules={sorted.map((m) => ({
        key: m.key,
        name: m.name,
        name_plural: m.name_plural ?? null,
      }))}
      defaultModuleKey={defaultModuleKey}
    />
  );
}
