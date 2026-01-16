import { Mail } from 'lucide-react';
import IntegrationCategoryPage from '../_components/IntegrationCategoryPage';

export default function EmailIntegrationsPage() {
  return (
    <IntegrationCategoryPage
      connectionType="email"
      title="Email Integrations"
      description="Connect email services for sending and tracking"
      icon={<Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
      providers={['sendgrid', 'resend', 'mailgun']}
    />
  );
}
