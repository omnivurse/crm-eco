import { ShoppingBag } from 'lucide-react';
import IntegrationCategoryPage from '../_components/IntegrationCategoryPage';

export default function CommerceIntegrationsPage() {
  return (
    <IntegrationCategoryPage
      connectionType="commerce"
      title="Commerce Integrations"
      description="Connect e-commerce platforms"
      icon={<ShoppingBag className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
      providers={['shopify', 'woocommerce', 'bigcommerce']}
    />
  );
}
