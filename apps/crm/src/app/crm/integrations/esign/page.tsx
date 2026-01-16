import { PenTool } from 'lucide-react';
import IntegrationCategoryPage from '../_components/IntegrationCategoryPage';

export default function EsignIntegrationsPage() {
  return (
    <IntegrationCategoryPage
      connectionType="esign"
      title="E-Signature Integrations"
      description="Connect electronic signature platforms"
      icon={<PenTool className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
      providers={['docusign', 'pandadoc', 'hellosign']}
    />
  );
}
