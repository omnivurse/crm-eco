'use client';

import * as React from 'react';
import {
  LayoutGrid,
  Users,
  Shield,
  Heart,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { cn } from '../lib/utils';

type AppType = 'crm' | 'admin' | 'portal';

interface App {
  id: AppType;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  hoverBg: string;
  url: string;
  isExternal?: boolean;
}

// URLs for each app - use environment variables in production
// These are the Vercel deployment URLs
const APP_URLS = {
  crm: process.env.NEXT_PUBLIC_CRM_URL || 'https://crm-eco-crm.vercel.app/crm',
  admin: process.env.NEXT_PUBLIC_ADMIN_URL || 'https://crm-eco-admin.vercel.app',
  portal: process.env.NEXT_PUBLIC_PORTAL_URL || '', // Portal not yet available
};

const apps: App[] = [
  {
    id: 'crm',
    name: 'CRM',
    description: 'Sales & Operations',
    icon: <Users className="w-5 h-5" />,
    color: 'text-teal-600',
    bgColor: 'bg-teal-100',
    hoverBg: 'hover:bg-teal-50',
    url: APP_URLS.crm,
    isExternal: true,
  },
  {
    id: 'admin',
    name: 'Admin',
    description: 'System Administration',
    icon: <Shield className="w-5 h-5" />,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    hoverBg: 'hover:bg-purple-50',
    url: APP_URLS.admin,
    isExternal: true,
  },
  {
    id: 'portal',
    name: 'Portal',
    description: 'Member Self-Service (Coming Soon)',
    icon: <Heart className="w-5 h-5" />,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
    hoverBg: 'hover:bg-emerald-50',
    url: APP_URLS.portal,
    isExternal: true,
  },
];

interface AppSwitcherProps {
  currentApp: AppType;
  className?: string;
}

export function AppSwitcher({ currentApp, className }: AppSwitcherProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const current = apps.find(app => app.id === currentApp) || apps[0];
  // Filter out current app and apps with empty URLs (not yet available)
  const otherApps = apps.filter(app => app.id !== currentApp && app.url);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on escape key
  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200',
          'bg-slate-100 hover:bg-slate-200 border border-slate-200',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
        )}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <div className={cn('w-7 h-7 rounded-md flex items-center justify-center', current.bgColor, current.color)}>
          {current.icon}
        </div>
        <span className="text-sm font-semibold text-slate-700 hidden sm:inline">
          {current.name}
        </span>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-slate-400 transition-transform duration-200',
            isOpen && 'transform rotate-180'
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={cn(
            'absolute left-0 mt-2 w-72 rounded-xl bg-white shadow-xl border border-slate-200',
            'z-50 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200'
          )}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Switch Application
              </span>
            </div>
          </div>

          {/* Current App (Highlighted) */}
          <div className="p-2">
            <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-3">
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', current.bgColor, current.color)}>
                  {current.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{current.name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                      Current
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{current.description}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="px-4">
            <div className="border-t border-slate-100" />
          </div>

          {/* Other Apps */}
          <div className="p-2">
            {otherApps.map((app) => (
              <a
                key={app.id}
                href={app.url}
                onClick={() => setIsOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-150',
                  'hover:bg-slate-50 group'
                )}
              >
                <div className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
                  'bg-slate-100 text-slate-500',
                  'group-hover:' + app.bgColor.replace('bg-', 'bg-'),
                  'group-hover:' + app.color.replace('text-', 'text-')
                )}
                  style={{
                    '--hover-bg': app.bgColor,
                    '--hover-color': app.color,
                  } as React.CSSProperties}
                >
                  <div className={cn('transition-colors', 'group-hover:' + app.color)}>
                    {app.icon}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 block">
                    {app.name}
                  </span>
                  <p className="text-xs text-slate-400 group-hover:text-slate-500">
                    {app.description}
                  </p>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition-colors" />
              </a>
            ))}
          </div>

          {/* Footer hint */}
          <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 rounded-b-xl">
            <p className="text-xs text-slate-400 text-center">
              Session is shared across all apps
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export type { AppType };
