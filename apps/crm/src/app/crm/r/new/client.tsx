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

// ============================================================================
// Icon Map
// ============================================================================

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

/** Color palette per module key for visual differentiation */
const MODULE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  leads: {
    bg: 'bg-blue-50 dark:bg-blue-500/10',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-500/20 hover:border-blue-400 dark:hover:border-blue-500/40',
  },
  contacts: {
    bg: 'bg-indigo-50 dark:bg-indigo-500/10',
    text: 'text-indigo-600 dark:text-indigo-400',
    border: 'border-indigo-200 dark:border-indigo-500/20 hover:border-indigo-400 dark:hover:border-indigo-500/40',
  },
  accounts: {
    bg: 'bg-purple-50 dark:bg-purple-500/10',
    text: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-500/20 hover:border-purple-400 dark:hover:border-purple-500/40',
  },
  deals: {
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-500/20 hover:border-emerald-400 dark:hover:border-emerald-500/40',
  },
  products: {
    bg: 'bg-orange-50 dark:bg-orange-500/10',
    text: 'text-orange-600 dark:text-orange-400',
    border: 'border-orange-200 dark:border-orange-500/20 hover:border-orange-400 dark:hover:border-orange-500/40',
  },
  vendors: {
    bg: 'bg-rose-50 dark:bg-rose-500/10',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-200 dark:border-rose-500/20 hover:border-rose-400 dark:hover:border-rose-500/40',
  },
};

const DEFAULT_COLOR = {
  bg: 'bg-slate-50 dark:bg-slate-500/10',
  text: 'text-slate-600 dark:text-slate-400',
  border: 'border-slate-200 dark:border-slate-500/20 hover:border-slate-400 dark:hover:border-slate-500/40',
};

// ============================================================================
// Component
// ============================================================================

interface ModuleSelectorProps {
  modules: { key: string; name: string; icon: string }[];
}

export function ModuleSelector({ modules }: ModuleSelectorProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {modules.map((mod) => {
        const Icon = ICON_MAP[mod.icon] || FolderOpen;
        const colors = MODULE_COLORS[mod.key] || DEFAULT_COLOR;

        return (
          <Link
            key={mod.key}
            href={`/crm/r/new?module=${mod.key}`}
            className={`group flex flex-col items-center gap-3 p-6 rounded-xl border bg-white dark:bg-slate-900/50 transition-all shadow-sm hover:shadow-md ${colors.border}`}
          >
            <div className={`p-3 rounded-xl ${colors.bg} transition-colors`}>
              <Icon className={`w-6 h-6 ${colors.text}`} />
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
