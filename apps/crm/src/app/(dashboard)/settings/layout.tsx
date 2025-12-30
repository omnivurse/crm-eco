'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, Users, Settings, Layers } from 'lucide-react';
import { cn } from '@crm-eco/ui';

const settingsNavItems = [
  {
    href: '/settings/organization',
    label: 'Organization',
    icon: Building2,
    description: 'Manage your organization details',
  },
  {
    href: '/settings/users',
    label: 'Users & Roles',
    icon: Users,
    description: 'Manage team members and permissions',
  },
  {
    href: '/settings/custom-fields',
    label: 'Custom Fields',
    icon: Layers,
    description: 'Define custom fields for entities',
  },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      {/* Settings Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
        <div className="p-2 bg-slate-100 rounded-lg">
          <Settings className="w-6 h-6 text-slate-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-500 text-sm">
            Manage your organization and application settings
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Settings Navigation */}
        <nav className="lg:col-span-1 space-y-1">
          {settingsNavItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'hover:bg-slate-50 text-slate-700'
                )}
              >
                <item.icon className={cn(
                  'w-5 h-5 mt-0.5',
                  isActive ? 'text-blue-600' : 'text-slate-400'
                )} />
                <div>
                  <p className="font-medium">{item.label}</p>
                  <p className={cn(
                    'text-xs',
                    isActive ? 'text-blue-600' : 'text-slate-400'
                  )}>
                    {item.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Settings Content */}
        <div className="lg:col-span-3">
          {children}
        </div>
      </div>
    </div>
  );
}

