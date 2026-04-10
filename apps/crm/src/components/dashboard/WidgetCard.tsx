import { cn } from '@crm-eco/ui/lib/utils';
import type { ReactNode } from 'react';

interface WidgetCardProps {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  gradient: string;
  badge?: string;
  badgeColor?: string;
  headerAction?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  isDragging?: boolean;
}

export function WidgetCard({
  title,
  subtitle,
  icon,
  gradient,
  badge,
  badgeColor = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
  headerAction,
  footer,
  children,
  className,
  isDragging,
}: WidgetCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-700/50',
        'shadow-[0_1px_2px_rgba(0,0,0,0.04),0_1px_6px_rgba(0,0,0,0.03)]',
        'hover:shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.05)]',
        'transition-shadow duration-200',
        isDragging && 'ring-2 ring-teal-500 ring-offset-1 shadow-lg',
        className
      )}
    >
      {/* Gradient accent bar */}
      <div className={cn('absolute top-0 left-0 right-0 h-[3px]', gradient)} />

      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={cn('p-2 rounded-lg', gradient.replace('bg-gradient-to-r', 'bg-gradient-to-br'))}>
              {icon}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
                {title}
              </h3>
              {subtitle && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {badge && (
              <span
                className={cn(
                  'text-xs font-semibold px-2 py-1 rounded-full',
                  badgeColor
                )}
              >
                {badge}
              </span>
            )}
            {headerAction}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-3">{children}</div>

      {/* Footer */}
      {footer && (
        <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800">
          {footer}
        </div>
      )}
    </div>
  );
}
