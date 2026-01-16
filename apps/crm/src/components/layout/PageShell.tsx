'use client';

import { cn } from '@crm-eco/ui/lib/utils';

interface PageShellProps {
  children: React.ReactNode;
  className?: string;
  /** Maximum width constraint - defaults to 7xl */
  maxWidth?: 'full' | '7xl' | '6xl' | '5xl' | '4xl';
  /** Add horizontal padding - defaults to true */
  padded?: boolean;
}

const maxWidthClasses = {
  full: 'max-w-full',
  '7xl': 'max-w-7xl',
  '6xl': 'max-w-6xl',
  '5xl': 'max-w-5xl',
  '4xl': 'max-w-4xl',
};

/**
 * PageShell - Main content wrapper with consistent spacing and max-width
 * 
 * Use this component to wrap page content for consistent layout across the CRM.
 */
export function PageShell({
  children,
  className,
  maxWidth = '7xl',
  padded = true,
}: PageShellProps) {
  return (
    <div
      className={cn(
        'w-full mx-auto',
        maxWidthClasses[maxWidth],
        padded && 'px-4 sm:px-6 lg:px-8',
        className
      )}
    >
      {children}
    </div>
  );
}
