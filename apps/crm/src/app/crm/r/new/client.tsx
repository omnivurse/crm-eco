'use client';

/**
 * Client component for the "Create New Record" module selector.
 * Renders a card grid of available CRM modules.
 */

import Link from 'next/link';
import {
  Users,
  UserPlus,
  Building,
  DollarSign,
  Package,
  Briefcase,
  FolderOpen,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import { resolveModulePalette } from '@/components/crm/records/v2/tokens';

/** Maps module icon strings to Lucide components */
const ICON_MAP: Record<string, LucideIcon> = {
  users: Users,
  'user-plus': UserPlus,
  building: Building,
  'dollar-sign': DollarSign,
  package: Package,
  briefcase: Briefcase,
  'folder-open': FolderOpen,
  'file-text': FileText,
};

interface ModuleSelectorProps {
  modules: { key: string; name: string; icon: string }[];
}

export function ModuleSelector({ modules }: ModuleSelectorProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {modules.map((mod) => {
        const Icon = ICON_MAP[mod.icon] || FolderOpen;
        const colors = resolveModulePalette(mod.key);

        return (
          <Link
            key={mod.key}
            href={`/crm/r/new?module=${mod.key}`}
            className={cn(
              'group flex flex-col items-center gap-3 p-6 rounded-xl border bg-white dark:bg-slate-900/50 transition-all shadow-sm hover:shadow-md',
              colors.border,
            )}
          >
            <div className={cn('p-3 rounded-xl transition-colors', colors.bg)}>
              <Icon className={cn('w-6 h-6', colors.text)} />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                {mod.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Create new {mod.name.toLowerCase()}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
