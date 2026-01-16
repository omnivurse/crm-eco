import { MessageSquare } from 'lucide-react';
import IntegrationCategoryPage from '../_components/IntegrationCategoryPage';

export default function ChatIntegrationsPage() {
  return (
    <IntegrationCategoryPage
      connectionType="chat"
      title="Chat Integrations"
      description="Connect team messaging and chat platforms"
      icon={<MessageSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
      providers={['slack', 'whatsapp']}
    />
  );
}
