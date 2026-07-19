'use client';

import { ReactNode } from 'react';
import { CaretLeft } from '@phosphor-icons/react';
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
          className="group mb-4 flex items-center gap-1.5 text-sm text-[var(--adm-muted)] transition-colors hover:text-[var(--adm-ink)]"
        >
          <CaretLeft weight="light" className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
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
                'font-bold tracking-tight text-[var(--adm-ink)]',
                size === 'large' ? 'text-3xl' : size === 'small' ? 'text-xl' : 'text-2xl'
              )}
            >
              {title}
            </h1>
            {description && (
              <p
                className={cn(
                  'mt-1 text-[var(--adm-muted)]',
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
        'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-[var(--adm-hairline)]',
        className
      )}
    >
      <div>
        <h2 className="text-lg font-semibold text-[var(--adm-ink)]">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-[var(--adm-muted)]">{description}</p>
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
        'flex items-center justify-between p-6 border-b border-[var(--adm-hairline)]',
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
          <h3 className="text-lg font-bold text-[var(--adm-ink)]">{title}</h3>
          {description && (
            <p className="text-sm text-[var(--adm-muted)]">{description}</p>
          )}
        </div>
      </div>
      {actions}
    </div>
  );
}
