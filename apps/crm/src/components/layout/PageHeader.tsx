'use client';

import { cn } from '@crm-eco/ui/lib/utils';

interface PageHeaderProps {
  /** Page title */
  title: string;
  /** Optional description/subtitle */
  description?: string;
  /** Icon to display before the title */
  icon?: React.ReactNode;
  /** Actions to display on the right side */
  actions?: React.ReactNode;
  /** Additional class names */
  className?: string;
  /** Badge or status indicator next to title */
  badge?: React.ReactNode;
}

/**
 * PageHeader - Consistent page header with title, description, and actions
 * 
 * Use this component at the top of pages for a unified look.
 */
export function PageHeader({
  title,
  description,
  icon,
  actions,
  className,
  badge,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between',
        'pb-6 mb-6 border-b border-slate-200 dark:border-white/10',
        className
      )}
    >
      <div className="flex items-start gap-4">
        {icon && (
          <div className="flex-shrink-0 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <div className="w-6 h-6 text-slate-600 dark:text-slate-400">
              {icon}
            </div>
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white truncate">
              {title}
            </h1>
            {badge}
          </div>
          {description && (
            <p className="mt-1 text-slate-500 dark:text-slate-400 text-sm">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
