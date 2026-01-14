'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
  TrendingUp,
  BarChart3,
  ClipboardList,
  HeartHandshake,
  PieChart,
  Wallet,
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
  'trending-up': TrendingUp,
  'bar-chart': BarChart3,
  'clipboard': ClipboardList,
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
    if (path === '/crm') {
      return pathname === '/crm';
    }
    return pathname.startsWith(path);
  };

  return (
    <aside
      className={cn(
        'relative flex flex-col transition-all duration-300 ease-in-out border-r',
        'glass-strong',
        collapsed ? 'w-[72px]' : 'w-[260px]'
      )}
    >
      {/* Gradient accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] gradient-primary opacity-60" />

      {/* Logo / Org Name */}
      <div className="flex items-center h-16 px-4">
        <Link href="/crm" className="flex items-center gap-3 min-w-0 group">
          <div className="relative flex-shrink-0 w-10 h-10 rounded-xl overflow-hidden gradient-primary p-[1px] group-hover:shadow-lg transition-all duration-300">
            <div className="w-full h-full rounded-[10px] bg-white dark:bg-slate-900 flex items-center justify-center">
              <Heart className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
          </div>
          {!collapsed && (
            <div className="min-w-0 animate-fade-in-up" style={{ animationDuration: '0.2s' }}>
              <h1 className="text-sm font-bold text-slate-900 dark:text-white truncate tracking-tight">
                {organizationName || 'Pay It Forward'}
              </h1>
              <p className="text-[10px] font-medium text-teal-600 dark:text-teal-400 uppercase tracking-wider">
                Healthshare CRM
              </p>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 scrollbar-thin">
        {/* Dashboard */}
        <div className="mb-6">
          <Link href="/crm">
            <Button
              variant="ghost"
              className={cn(
                'w-full gap-3 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all duration-200',
                'hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl h-11',
                isActive('/crm') && pathname === '/crm' && 
                  'bg-teal-50 dark:bg-gradient-to-r dark:from-teal-500/20 dark:to-emerald-500/10 text-teal-700 dark:text-white border border-teal-200 dark:border-teal-500/30',
                collapsed ? 'justify-center px-2' : 'justify-start px-3'
              )}
            >
              <LayoutDashboard className={cn(
                'w-5 h-5 flex-shrink-0 transition-colors',
                isActive('/crm') && pathname === '/crm' && 'text-teal-600 dark:text-teal-400'
              )} />
              {!collapsed && <span className="font-medium">Dashboard</span>}
            </Button>
          </Link>
        </div>

        {/* Modules Section */}
        {!collapsed && (
          <div className="mb-3 px-1">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.15em]">
              Modules
            </p>
          </div>
        )}
        <div className="space-y-1">
          {modules.map((module, index) => {
            const Icon = getIcon(module.icon);
            const path = `/crm/modules/${module.key}`;
            return (
              <Link key={module.id} href={path}>
                <Button
                  variant="ghost"
                  className={cn(
                    'w-full gap-3 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all duration-200',
                    'hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl h-10',
                    isActive(path) && 
                      'bg-teal-50 dark:bg-gradient-to-r dark:from-teal-500/20 dark:to-transparent text-teal-700 dark:text-white border-l-2 border-teal-500 dark:border-teal-400',
                    collapsed ? 'justify-center px-2' : 'justify-start px-3'
                  )}
                  title={collapsed ? module.name : undefined}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <Icon className={cn(
                    'w-5 h-5 flex-shrink-0 transition-colors',
                    isActive(path) && 'text-teal-600 dark:text-teal-400'
                  )} />
                  {!collapsed && (
                    <span className="font-medium truncate">
                      {module.name_plural || module.name + 's'}
                    </span>
                  )}
                </Button>
              </Link>
            );
          })}
        </div>

        {/* Tools Section */}
        {!collapsed && (
          <div className="mt-8 mb-3 px-1">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.15em]">
              Tools
            </p>
          </div>
        )}
        {collapsed && <div className="mt-6" />}
        <div className="space-y-1">
          <Link href="/crm/import">
            <Button
              variant="ghost"
              className={cn(
                'w-full gap-3 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all duration-200',
                'hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl h-10',
                isActive('/crm/import') && 
                  'bg-emerald-50 dark:bg-gradient-to-r dark:from-emerald-500/20 dark:to-transparent text-emerald-700 dark:text-white border-l-2 border-emerald-500 dark:border-emerald-400',
                collapsed ? 'justify-center px-2' : 'justify-start px-3'
              )}
              title={collapsed ? 'Import' : undefined}
            >
              <Upload className={cn(
                'w-5 h-5 flex-shrink-0 transition-colors',
                isActive('/crm/import') && 'text-emerald-600 dark:text-emerald-400'
              )} />
              {!collapsed && <span className="font-medium">Import Data</span>}
            </Button>
          </Link>

          <Link href="/crm/pipeline">
            <Button
              variant="ghost"
              className={cn(
                'w-full gap-3 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all duration-200',
                'hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl h-10',
                isActive('/crm/pipeline') && 
                  'bg-teal-50 dark:bg-gradient-to-r dark:from-teal-500/20 dark:to-transparent text-teal-700 dark:text-white border-l-2 border-teal-500 dark:border-teal-400',
                collapsed ? 'justify-center px-2' : 'justify-start px-3'
              )}
              title={collapsed ? 'Pipeline' : undefined}
            >
              <TrendingUp className={cn(
                'w-5 h-5 flex-shrink-0 transition-colors',
                isActive('/crm/pipeline') && 'text-teal-600 dark:text-teal-400'
              )} />
              {!collapsed && <span className="font-medium">Sales Pipeline</span>}
            </Button>
          </Link>

          <Link href="/crm/reports">
            <Button
              variant="ghost"
              className={cn(
                'w-full gap-3 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all duration-200',
                'hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl h-10',
                isActive('/crm/reports') && 
                  'bg-violet-50 dark:bg-gradient-to-r dark:from-violet-500/20 dark:to-transparent text-violet-700 dark:text-white border-l-2 border-violet-500 dark:border-violet-400',
                collapsed ? 'justify-center px-2' : 'justify-start px-3'
              )}
              title={collapsed ? 'Reports' : undefined}
            >
              <BarChart3 className={cn(
                'w-5 h-5 flex-shrink-0 transition-colors',
                isActive('/crm/reports') && 'text-violet-600 dark:text-violet-400'
              )} />
              {!collapsed && <span className="font-medium">Reports</span>}
            </Button>
          </Link>

          <Link href="/crm/analytics">
            <Button
              variant="ghost"
              className={cn(
                'w-full gap-3 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all duration-200',
                'hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl h-10',
                isActive('/crm/analytics') && 
                  'bg-indigo-50 dark:bg-gradient-to-r dark:from-indigo-500/20 dark:to-transparent text-indigo-700 dark:text-white border-l-2 border-indigo-500 dark:border-indigo-400',
                collapsed ? 'justify-center px-2' : 'justify-start px-3'
              )}
              title={collapsed ? 'Analytics' : undefined}
            >
              <PieChart className={cn(
                'w-5 h-5 flex-shrink-0 transition-colors',
                isActive('/crm/analytics') && 'text-indigo-600 dark:text-indigo-400'
              )} />
              {!collapsed && <span className="font-medium">Analytics</span>}
            </Button>
          </Link>

          <Link href="/crm/commissions">
            <Button
              variant="ghost"
              className={cn(
                'w-full gap-3 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all duration-200',
                'hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl h-10',
                isActive('/crm/commissions') && 
                  'bg-amber-50 dark:bg-gradient-to-r dark:from-amber-500/20 dark:to-transparent text-amber-700 dark:text-white border-l-2 border-amber-500 dark:border-amber-400',
                collapsed ? 'justify-center px-2' : 'justify-start px-3'
              )}
              title={collapsed ? 'Commissions' : undefined}
            >
              <Wallet className={cn(
                'w-5 h-5 flex-shrink-0 transition-colors',
                isActive('/crm/commissions') && 'text-amber-600 dark:text-amber-400'
              )} />
              {!collapsed && <span className="font-medium">Commissions</span>}
            </Button>
          </Link>
        </div>

        {/* Health Sharing Section */}
        {!collapsed && (
          <div className="mt-8 mb-3 px-1">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.15em]">
              Health Sharing
            </p>
          </div>
        )}
        {collapsed && <div className="mt-6" />}
        <div className="space-y-1">
          <Link href="/crm/enrollment">
            <Button
              variant="ghost"
              className={cn(
                'w-full gap-3 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all duration-200',
                'hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl h-10',
                isActive('/crm/enrollment') && 
                  'bg-teal-50 dark:bg-gradient-to-r dark:from-teal-500/20 dark:to-transparent text-teal-700 dark:text-white border-l-2 border-teal-500 dark:border-teal-400',
                collapsed ? 'justify-center px-2' : 'justify-start px-3'
              )}
              title={collapsed ? 'Enrollment' : undefined}
            >
              <ClipboardList className={cn(
                'w-5 h-5 flex-shrink-0 transition-colors',
                isActive('/crm/enrollment') && 'text-teal-600 dark:text-teal-400'
              )} />
              {!collapsed && <span className="font-medium">Enrollment</span>}
            </Button>
          </Link>

          <Link href="/crm/needs">
            <Button
              variant="ghost"
              className={cn(
                'w-full gap-3 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all duration-200',
                'hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl h-10',
                isActive('/crm/needs') && 
                  'bg-rose-50 dark:bg-gradient-to-r dark:from-rose-500/20 dark:to-transparent text-rose-700 dark:text-white border-l-2 border-rose-500 dark:border-rose-400',
                collapsed ? 'justify-center px-2' : 'justify-start px-3'
              )}
              title={collapsed ? 'Needs' : undefined}
            >
              <Heart className={cn(
                'w-5 h-5 flex-shrink-0 transition-colors',
                isActive('/crm/needs') && 'text-rose-600 dark:text-rose-400'
              )} />
              {!collapsed && <span className="font-medium">Needs</span>}
            </Button>
          </Link>
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-200 dark:border-white/5 p-3 space-y-2">
        {/* Settings */}
        <Link href="/crm/settings">
          <Button
            variant="ghost"
            className={cn(
              'w-full gap-3 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all duration-200',
              'hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl h-10',
              isActive('/crm/settings') && 'bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white',
              collapsed ? 'justify-center px-2' : 'justify-start px-3'
            )}
            title={collapsed ? 'Settings' : undefined}
          >
            <Settings className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="font-medium">Settings</span>}
          </Button>
        </Link>

        {/* Collapse Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'w-full h-9 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all duration-200',
            'hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg',
            collapsed ? 'justify-center' : 'justify-center'
          )}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4 mr-2" />
              <span className="text-xs font-medium">Collapse</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
