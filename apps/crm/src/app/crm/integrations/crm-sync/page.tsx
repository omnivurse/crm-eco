import { Database } from 'lucide-react';
import IntegrationCategoryPage from '../_components/IntegrationCategoryPage';

export default function CrmSyncIntegrationsPage() {
  return (
    <IntegrationCategoryPage
      connectionType="crm_sync"
      title="CRM Sync Integrations"
      description="Sync data with external CRM platforms"
      icon={<Database className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
      providers={['zoho', 'salesforce', 'hubspot']}
    />
  );
}
