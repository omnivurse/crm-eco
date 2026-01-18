'use client';

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
        'relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/50',
        'shadow-[0_1px_3px_rgba(0,0,0,0.05),0_20px_25px_-5px_rgba(0,0,0,0.05)]',
        'transition-all duration-200',
        isDragging && 'ring-2 ring-teal-500 ring-offset-2 shadow-2xl',
        className
      )}
    >
      {/* Gradient accent bar */}
      <div className={cn('absolute top-0 left-0 right-0 h-1', gradient)} />

      {/* Header */}
      <div className="p-6 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('p-2.5 rounded-xl', gradient.replace('bg-gradient-to-r', 'bg-gradient-to-br'))}>
              {icon}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {title}
              </h3>
              {subtitle && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {badge && (
              <span
                className={cn(
                  'text-sm font-semibold px-3 py-1.5 rounded-full',
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
      <div className="p-4">{children}</div>

      {/* Footer */}
      {footer && (
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800">
          {footer}
        </div>
      )}
    </div>
  );
}
