import Link from 'next/link';
import { Mail, Phone, Calendar, MessageCircle, Video, Webhook, ScrollText } from 'lucide-react';

export const metadata = {
  title: 'Integrations | OmnialForce CRM',
  description: 'Manage your connected integrations',
};

const categories = [
  { name: 'Email', description: 'Email delivery and tracking', href: '/crm/integrations/email', icon: Mail },
  { name: 'SMS / Voice', description: 'Text messaging and voice calls', href: '/crm/integrations/phone', icon: Phone },
  { name: 'Calendar', description: 'Calendar sync and scheduling', href: '/crm/integrations/calendar', icon: Calendar },
  { name: 'WhatsApp', description: 'WhatsApp messaging', href: '/crm/integrations/chat', icon: MessageCircle },
  { name: 'Video', description: 'Video conferencing', href: '/crm/integrations/video', icon: Video },
  { name: 'Webhooks', description: 'Webhook endpoints and events', href: '/crm/integrations/webhooks', icon: Webhook },
  { name: 'Logs', description: 'Integration activity logs', href: '/crm/integrations/logs', icon: ScrollText },
];

export default function IntegrationsPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <p className="text-gray-500 mt-1">Manage your connected services and integrations.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => (
          <Link
            key={cat.href}
            href={cat.href}
            className="flex items-start gap-4 p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all bg-white"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <cat.icon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">{cat.name}</h3>
              <p className="text-sm text-gray-500 mt-0.5">{cat.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
