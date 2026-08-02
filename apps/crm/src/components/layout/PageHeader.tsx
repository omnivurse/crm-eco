'use client';

import { IdentityActionsHeader } from '@crm-eco/ui/components/identity-actions-header';
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
 * PageHeader — branded CRM skin over IdentityActionsHeader.
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
    <IdentityActionsHeader
      breakpoint="sm"
      align="center"
      className={cn('pb-6 mb-6 border-b border-slate-200 dark:border-white/10', className)}
      leading={
        icon ? (
          <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <div className="w-6 h-6 text-slate-600 dark:text-slate-400">{icon}</div>
          </div>
        ) : undefined
      }
      identity={
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <h1
              className="text-2xl font-bold text-slate-900 dark:text-white break-words min-w-0"
              title={title}
            >
              {title}
            </h1>
            {badge}
          </div>
          {description && (
            <p className="mt-1 text-slate-500 dark:text-slate-400 text-sm">{description}</p>
          )}
        </>
      }
      actions={actions}
    />
  );
}
