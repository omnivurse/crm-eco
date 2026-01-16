import { Phone } from 'lucide-react';
import IntegrationCategoryPage from '../_components/IntegrationCategoryPage';

export default function PhoneIntegrationsPage() {
  return (
    <IntegrationCategoryPage
      connectionType="phone"
      title="Phone & SMS Integrations"
      description="Connect telephony and messaging services"
      icon={<Phone className="w-5 h-5 text-green-600 dark:text-green-400" />}
      providers={['twilio', 'ringcentral', 'goto']}
    />
  );
}
