'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Mail, Phone, Calendar, MessageCircle, Video, Webhook, ScrollText,
  Key, Puzzle, Package,
} from 'lucide-react';
import { Suspense } from 'react';
import ApiKeysManager from './ApiKeysManager';
import ExtensionsCatalog from './ExtensionsCatalog';
import InstalledExtensions from './InstalledExtensions';

// ---------------------------------------------------------------------------
// Integration categories grid (original page content)
// ---------------------------------------------------------------------------

const categories = [
  { name: 'Email', description: 'Email delivery and tracking', href: '/crm/integrations/email', icon: Mail },
  { name: 'SMS / Voice', description: 'Text messaging and voice calls', href: '/crm/integrations/phone', icon: Phone },
  { name: 'Calendar', description: 'Calendar sync and scheduling', href: '/crm/integrations/calendar', icon: Calendar },
  { name: 'WhatsApp', description: 'WhatsApp messaging', href: '/crm/integrations/chat', icon: MessageCircle },
  { name: 'Video', description: 'Video conferencing', href: '/crm/integrations/video', icon: Video },
  { name: 'Webhooks', description: 'Webhook endpoints and events', href: '/crm/integrations/webhooks', icon: Webhook },
  { name: 'Logs', description: 'Integration activity logs', href: '/crm/integrations/logs', icon: ScrollText },
];

// ---------------------------------------------------------------------------
// Tabs configuration
// ---------------------------------------------------------------------------

const TABS = [
  { key: null, label: 'Overview', icon: null },
  { key: 'api-keys', label: 'API Keys', icon: Key },
  { key: 'extensions', label: 'Extensions', icon: Puzzle },
  { key: 'installed', label: 'Installed', icon: Package },
] as const;

// ---------------------------------------------------------------------------
// Inner component that reads search params
// ---------------------------------------------------------------------------

function IntegrationsInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const currentTab = searchParams.get('tab');

  function setTab(tab: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (tab) {
      params.set('tab', tab);
    } else {
      params.delete('tab');
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Integrations</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your connected services and integrations.</p>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 mb-6 border-b border-slate-200 dark:border-white/10 overflow-x-auto">
        {TABS.map((tab) => {
          const isActive = currentTab === tab.key;
          return (
            <button
              key={tab.key ?? '__overview'}
              onClick={() => setTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                isActive
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {tab.icon && <tab.icon className="w-4 h-4" />}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {currentTab === 'api-keys' && <ApiKeysManager />}
      {currentTab === 'extensions' && <ExtensionsCatalog />}
      {currentTab === 'installed' && <InstalledExtensions />}

      {/* Default: show the integration categories grid */}
      {!currentTab && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.href}
              href={cat.href}
              className="flex items-start gap-4 p-4 rounded-lg border border-gray-200 dark:border-white/10 hover:border-blue-300 hover:shadow-sm transition-all bg-white dark:bg-white/5"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                <cat.icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">{cat.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{cat.description}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exported wrapper with Suspense (required for useSearchParams)
// ---------------------------------------------------------------------------

export default function IntegrationsPageClient() {
  return (
    <Suspense fallback={
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Integrations</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your connected services and integrations.</p>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    }>
      <IntegrationsInner />
    </Suspense>
  );
}
