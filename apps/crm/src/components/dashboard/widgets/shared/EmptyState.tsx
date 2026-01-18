'use client';

import { cn } from '@crm-eco/ui/lib/utils';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  className?: string;
}

export function EmptyState({ icon, title, subtitle, className }: EmptyStateProps) {
  return (
    <div className={cn('text-center py-12', className)}>
      <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-800/50 rounded-2xl flex items-center justify-center">
        {icon}
      </div>
      <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">
        {title}
      </p>
      {subtitle && (
        <p className="text-sm text-slate-400 dark:text-slate-500">{subtitle}</p>
      )}
    </div>
  );
}
