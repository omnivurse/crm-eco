'use client';

import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';

export interface BreadcrumbItem {
  /** Display label */
  label: string;
  /** Link href - if not provided, item is treated as current page */
  href?: string;
  /** Optional icon */
  icon?: React.ReactNode;
}

interface BreadcrumbsProps {
  /** Array of breadcrumb items */
  items: BreadcrumbItem[];
  /** Show home icon as first item */
  showHome?: boolean;
  /** Home href - defaults to /crm */
  homeHref?: string;
  /** Additional class names */
  className?: string;
}

/**
 * Breadcrumbs - Navigation breadcrumb trail
 * 
 * Shows the current navigation path with clickable ancestors.
 */
export function Breadcrumbs({
  items,
  showHome = true,
  homeHref = '/crm',
  className,
}: BreadcrumbsProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('flex items-center text-sm', className)}
    >
      <ol className="flex items-center gap-1">
        {showHome && (
          <>
            <li>
              <Link
                href={homeHref}
                className="flex items-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <Home className="w-4 h-4" />
                <span className="sr-only">Home</span>
              </Link>
            </li>
            {items.length > 0 && (
              <li aria-hidden="true">
                <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              </li>
            )}
          </>
        )}
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const isClickable = !!item.href && !isLast;

          return (
            <li key={item.label} className="flex items-center gap-1">
              {isClickable ? (
                <Link
                  href={item.href!}
                  className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ) : (
                <span
                  className={cn(
                    'flex items-center gap-1.5',
                    isLast
                      ? 'text-slate-900 dark:text-white font-medium'
                      : 'text-slate-500 dark:text-slate-400'
                  )}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </span>
              )}
              {!isLast && (
                <ChevronRight
                  className="w-4 h-4 text-slate-400 dark:text-slate-500 ml-1"
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
