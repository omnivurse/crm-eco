'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@crm-eco/ui/lib/utils';
import { Button } from '@crm-eco/ui/components/button';
import type { CrmModule } from '@/lib/crm/types';
import {
  Users,
  UserPlus,
  DollarSign,
  Building,
  LayoutDashboard,
  Settings,
  Upload,
  ChevronLeft,
  ChevronRight,
  FileText,
  Target,
  Briefcase,
  Heart,
  type LucideIcon,
} from 'lucide-react';

// Icon mapping for modules
const iconMap: Record<string, LucideIcon> = {
  'user': Users,
  'user-plus': UserPlus,
  'users': Users,
  'dollar-sign': DollarSign,
  'building': Building,
  'file': FileText,
  'file-text': FileText,
  'target': Target,
  'briefcase': Briefcase,
  'heart': Heart,
};

interface CrmSidebarProps {
  modules: CrmModule[];
  organizationName?: string;
}

export function CrmSidebar({ modules, organizationName }: CrmSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const getIcon = (iconName: string): LucideIcon => {
    return iconMap[iconName] || FileText;
  };

  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(path);
  };

  return (
    <aside
      className={cn(
        'flex flex-col bg-brand-navy-900 text-white transition-all duration-300 ease-in-out',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo / Org Name */}
      <div className="flex items-center h-16 px-4 border-b border-brand-navy-700">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-brand-teal-500 to-brand-emerald-600 rounded-lg flex items-center justify-center">
            <Heart className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-white truncate">
                {organizationName || 'CRM'}
              </h1>
              <p className="text-xs text-brand-teal-400">Enterprise CRM</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {/* Dashboard */}
        <div className="px-3 mb-4">
          <Link href="/">
            <Button
              variant="ghost"
              className={cn(
                'w-full justify-start gap-3 text-white/70 hover:text-white hover:bg-brand-navy-800',
                isActive('/') && pathname === '/' && 'bg-brand-navy-800 text-white',
                collapsed && 'justify-center px-2'
              )}
            >
              <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>Dashboard</span>}
            </Button>
          </Link>
        </div>

        {/* Modules Section */}
        {!collapsed && (
          <div className="px-4 mb-2">
            <p className="text-xs font-medium text-brand-navy-400 uppercase tracking-wider">
              Modules
            </p>
          </div>
        )}
        <div className="px-3 space-y-1">
          {modules.map((module) => {
            const Icon = getIcon(module.icon);
            const path = `/modules/${module.key}`;
            return (
              <Link key={module.id} href={path}>
                <Button
                  variant="ghost"
                  className={cn(
                    'w-full justify-start gap-3 text-white/70 hover:text-white hover:bg-brand-navy-800',
                    isActive(path) && 'bg-brand-navy-800 text-white',
                    collapsed && 'justify-center px-2'
                  )}
                  title={collapsed ? module.name : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && <span>{module.name_plural || module.name + 's'}</span>}
                </Button>
              </Link>
            );
          })}
        </div>

        {/* Tools Section */}
        {!collapsed && (
          <div className="px-4 mt-6 mb-2">
            <p className="text-xs font-medium text-brand-navy-400 uppercase tracking-wider">
              Tools
            </p>
          </div>
        )}
        <div className="px-3 space-y-1">
          <Link href="/import">
            <Button
              variant="ghost"
              className={cn(
                'w-full justify-start gap-3 text-white/70 hover:text-white hover:bg-brand-navy-800',
                isActive('/import') && 'bg-brand-navy-800 text-white',
                collapsed && 'justify-center px-2'
              )}
              title={collapsed ? 'Import' : undefined}
            >
              <Upload className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>Import Data</span>}
            </Button>
          </Link>
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-brand-navy-700">
        {/* Settings */}
        <div className="px-3 py-3">
          <Link href="/settings">
            <Button
              variant="ghost"
              className={cn(
                'w-full justify-start gap-3 text-white/70 hover:text-white hover:bg-brand-navy-800',
                isActive('/settings') && 'bg-brand-navy-800 text-white',
                collapsed && 'justify-center px-2'
              )}
              title={collapsed ? 'Settings' : undefined}
            >
              <Settings className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>Settings</span>}
            </Button>
          </Link>
        </div>

        {/* Collapse Toggle */}
        <div className="px-3 pb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              'w-full justify-center text-white/50 hover:text-white hover:bg-brand-navy-800'
            )}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 mr-2" />
                <span className="text-xs">Collapse</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </aside>
  );
}
