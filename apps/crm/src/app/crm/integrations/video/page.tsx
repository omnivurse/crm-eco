import { Video } from 'lucide-react';
import IntegrationCategoryPage from '../_components/IntegrationCategoryPage';

export default function VideoIntegrationsPage() {
  return (
    <IntegrationCategoryPage
      connectionType="video"
      title="Video Integrations"
      description="Connect video conferencing platforms"
      icon={<Video className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
      providers={['zoom', 'google_meet', 'microsoft_teams', 'goto_meeting']}
    />
  );
}
