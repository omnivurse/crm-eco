import { CreditCard } from 'lucide-react';
import IntegrationCategoryPage from '../_components/IntegrationCategoryPage';

export default function PaymentsIntegrationsPage() {
  return (
    <IntegrationCategoryPage
      connectionType="payments"
      title="Payment Integrations"
      description="Connect payment processing services"
      icon={<CreditCard className="w-5 h-5 text-violet-600 dark:text-violet-400" />}
      providers={['stripe', 'square', 'authorize_net']}
    />
  );
}
