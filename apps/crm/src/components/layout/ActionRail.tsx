'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { cn } from '@crm-eco/ui/lib/utils';

interface ActionRailProps {
  /** Content to display in the rail */
  children: React.ReactNode;
  /** Title for the rail */
  title?: string;
  /** Whether the rail starts collapsed */
  defaultCollapsed?: boolean;
  /** Width when expanded */
  width?: 'sm' | 'md' | 'lg';
  /** Additional class names */
  className?: string;
  /** Position - right or left */
  position?: 'left' | 'right';
}

const widthClasses = {
  sm: 'w-64',
  md: 'w-80',
  lg: 'w-96',
};

/**
 * ActionRail - Collapsible side panel for actions and contextual content
 * 
 * Use this for action buttons, filters, or contextual information
 * that should be accessible but can be hidden to maximize content space.
 */
export function ActionRail({
  children,
  title,
  defaultCollapsed = false,
  width = 'md',
  className,
  position = 'right',
}: ActionRailProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <aside
      className={cn(
        'relative flex flex-col h-full transition-all duration-300 ease-in-out',
        'border-slate-200 dark:border-white/10 bg-white/50 dark:bg-slate-900/50',
        position === 'right' ? 'border-l' : 'border-r',
        collapsed ? 'w-12' : widthClasses[width],
        className
      )}
    >
      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setCollapsed(!collapsed)}
        className={cn(
          'absolute top-3 z-10 h-8 w-8 rounded-lg',
          'text-slate-500 hover:text-slate-900 dark:hover:text-white',
          'hover:bg-slate-100 dark:hover:bg-white/10',
          position === 'right' ? '-left-4' : '-right-4'
        )}
        title={collapsed ? 'Expand panel' : 'Collapse panel'}
      >
        {position === 'right' ? (
          collapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
        ) : (
          collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />
        )}
      </Button>

      {/* Header */}
      {title && !collapsed && (
        <div className="px-4 py-3 border-b border-slate-200 dark:border-white/10">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {title}
          </h3>
        </div>
      )}

      {/* Content */}
      <div
        className={cn(
          'flex-1 overflow-y-auto transition-opacity duration-200',
          collapsed ? 'opacity-0 pointer-events-none' : 'opacity-100 p-4'
        )}
      >
        {children}
      </div>
    </aside>
  );
}
