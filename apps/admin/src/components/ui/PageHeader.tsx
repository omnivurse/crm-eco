'use client';

import { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@crm-eco/ui';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  gradient?: string;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
  className?: string;
  size?: 'default' | 'large' | 'small';
}

export function PageHeader({
  title,
  description,
  icon,
  gradient = 'from-primary to-primary/80',
  actions,
  backHref,
  backLabel = 'Back',
  className,
  size = 'default',
}: PageHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  return (
    <div className={cn('mb-6', className)}>
      {/* Back button */}
      {backHref !== undefined && (
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors group"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          {backLabel}
        </button>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* Icon */}
          {icon && (
            <div
              className={cn(
                'flex-shrink-0 rounded-xl bg-gradient-to-br',
                gradient,
                size === 'large' ? 'p-4' : size === 'small' ? 'p-2' : 'p-3'
              )}
            >
              <div className="text-white">{icon}</div>
            </div>
          )}

          {/* Title and description */}
          <div>
            <h1
              className={cn(
                'font-bold text-slate-900 tracking-tight',
                size === 'large' ? 'text-3xl' : size === 'small' ? 'text-xl' : 'text-2xl'
              )}
            >
              {title}
            </h1>
            {description && (
              <p
                className={cn(
                  'text-slate-500 mt-1',
                  size === 'large' ? 'text-base' : 'text-sm'
                )}
              >
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        {actions && (
          <div className="flex items-center gap-3 flex-shrink-0">{actions}</div>
        )}
      </div>
    </div>
  );
}

// Variant for section headers within pages
interface SectionHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function SectionHeader({
  title,
  description,
  actions,
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200',
        className
      )}
    >
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {description && (
          <p className="text-sm text-slate-500 mt-0.5">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// Card header variant
interface CardHeaderTitleProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  iconBg?: string;
  actions?: ReactNode;
  className?: string;
}

export function CardHeaderTitle({
  title,
  description,
  icon,
  iconBg = 'bg-gradient-to-br from-primary to-primary/80',
  actions,
  className,
}: CardHeaderTitleProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between p-6 border-b border-slate-100',
        className
      )}
    >
      <div className="flex items-center gap-3">
        {icon && (
          <div className={cn('p-2.5 rounded-xl', iconBg)}>
            <div className="text-white">{icon}</div>
          </div>
        )}
        <div>
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          {description && (
            <p className="text-sm text-slate-500">{description}</p>
          )}
        </div>
      </div>
      {actions}
    </div>
  );
}
