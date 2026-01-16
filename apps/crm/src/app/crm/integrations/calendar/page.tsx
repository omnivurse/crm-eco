import { Calendar } from 'lucide-react';
import IntegrationCategoryPage from '../_components/IntegrationCategoryPage';

export default function CalendarIntegrationsPage() {
  return (
    <IntegrationCategoryPage
      connectionType="calendar"
      title="Calendar Integrations"
      description="Sync calendars for scheduling and events"
      icon={<Calendar className="w-5 h-5 text-orange-600 dark:text-orange-400" />}
      providers={['google_calendar', 'microsoft_outlook']}
    />
  );
}
