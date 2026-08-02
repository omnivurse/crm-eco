import * as React from 'react';
import { cn } from '../lib/utils';

/**
 * IdentityActionsHeader — deep layout module for "identity left, actions right".
 *
 * Owns the overflow-safe flex contract that used to leak into every app
 * PageHeader and entity detail page:
 *   - stack below `breakpoint`, row above it
 *   - identity column: min-w-0 flex-1
 *   - leading (avatar/back/icon): shrink-0
 *   - actions: flex-wrap, full-width below breakpoint, end-aligned above
 *
 * Branding and product chrome stay in callers (thin adapters).
 */

export type IdentityActionsBreakpoint = 'sm' | 'md' | 'lg' | 'xl';

export interface IdentityActionsHeaderProps {
  /** Title / meta / tags — receives min-w-0 flex-1. */
  identity: React.ReactNode;
  /** Action cluster — wrap-safe, never squeezes identity. */
  actions?: React.ReactNode;
  /** Optional back control, avatar, or icon tile — shrink-0. */
  leading?: React.ReactNode;
  /**
   * Viewport where the row becomes horizontal.
   * Page headers default to `sm`; dense record shells use `xl`.
   */
  breakpoint?: IdentityActionsBreakpoint;
  /** Cross-axis alignment when in a row. */
  align?: 'start' | 'center' | 'end';
  className?: string;
  identityClassName?: string;
  actionsClassName?: string;
  leadingClassName?: string;
}

const ROW_BY_BREAKPOINT: Record<IdentityActionsBreakpoint, string> = {
  sm: 'sm:flex-row sm:justify-between sm:gap-4',
  md: 'md:flex-row md:justify-between md:gap-4',
  lg: 'lg:flex-row lg:justify-between lg:gap-4',
  xl: 'xl:flex-row xl:justify-between xl:gap-4',
};

const ALIGN_BY_BREAKPOINT: Record<
  IdentityActionsBreakpoint,
  Record<'start' | 'center' | 'end', string>
> = {
  sm: {
    start: 'sm:items-start',
    center: 'sm:items-center',
    end: 'sm:items-end',
  },
  md: {
    start: 'md:items-start',
    center: 'md:items-center',
    end: 'md:items-end',
  },
  lg: {
    start: 'lg:items-start',
    center: 'lg:items-center',
    end: 'lg:items-end',
  },
  xl: {
    start: 'xl:items-start',
    center: 'xl:items-center',
    end: 'xl:items-end',
  },
};

const ACTIONS_BY_BREAKPOINT: Record<IdentityActionsBreakpoint, string> = {
  sm: 'sm:w-auto sm:justify-end',
  md: 'md:w-auto md:justify-end',
  lg: 'lg:w-auto lg:justify-end',
  xl: 'xl:w-auto xl:justify-end',
};

export function IdentityActionsHeader({
  identity,
  actions,
  leading,
  breakpoint = 'sm',
  align = 'start',
  className,
  identityClassName,
  actionsClassName,
  leadingClassName,
}: IdentityActionsHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3',
        ROW_BY_BREAKPOINT[breakpoint],
        ALIGN_BY_BREAKPOINT[breakpoint][align],
        className,
      )}
      data-identity-actions-header=""
      data-breakpoint={breakpoint}
    >
      <div className={cn('flex items-start gap-4 min-w-0 flex-1', align === 'center' && 'items-center')}>
        {leading != null && (
          <div className={cn('shrink-0', leadingClassName)}>{leading}</div>
        )}
        <div className={cn('min-w-0 flex-1', identityClassName)}>{identity}</div>
      </div>
      {actions != null && (
        <div
          className={cn(
            'flex flex-wrap items-center gap-2 shrink-0 w-full justify-start',
            ACTIONS_BY_BREAKPOINT[breakpoint],
            actionsClassName,
          )}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
