'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IdentityActionsHeader } from '@crm-eco/ui/components/identity-actions-header';
import { Button } from '@crm-eco/ui/components/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@crm-eco/ui/components/breadcrumb';
import { cn } from '@crm-eco/ui';
import { ChevronLeft } from 'lucide-react';

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
      {backHref !== undefined && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            {backLabel}
          </Button>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={backHref || '/'}>{backLabel}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      )}

      <IdentityActionsHeader
        breakpoint="sm"
        align="center"
        leading={
          icon ? (
            <div
              className={cn(
                'rounded-xl bg-gradient-to-br',
                gradient,
                size === 'large' ? 'p-4' : size === 'small' ? 'p-2' : 'p-3',
              )}
            >
              <div className="text-white">{icon}</div>
            </div>
          ) : undefined
        }
        identity={
          <>
            <h1
              className={cn(
                'font-semibold tracking-tight text-[var(--adm-ink)] break-words min-w-0',
                size === 'large' ? 'text-2xl sm:text-3xl' : size === 'small' ? 'text-lg' : 'text-xl sm:text-2xl',
              )}
            >
              {title}
            </h1>
            {description && (
              <p
                className={cn(
                  'mt-1 text-[var(--adm-muted)] break-words',
                  size === 'large' ? 'text-base' : 'text-sm',
                )}
              >
                {description}
              </p>
            )}
          </>
        }
        actions={actions}
        actionsClassName="gap-3"
      />
    </div>
  );
}

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
    <IdentityActionsHeader
      breakpoint="sm"
      align="center"
      className={cn('pb-4 border-b border-[var(--adm-hairline)]', className)}
      identity={
        <>
          <h2 className="text-lg font-semibold text-[var(--adm-ink)] break-words">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-[var(--adm-muted)] break-words">{description}</p>
          )}
        </>
      }
      actions={actions}
    />
  );
}

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
    <IdentityActionsHeader
      breakpoint="sm"
      align="center"
      className={cn('p-6 border-b border-[var(--adm-hairline)]', className)}
      leading={
        icon ? (
          <div className={cn('p-2.5 rounded-xl', iconBg)}>
            <div className="text-white">{icon}</div>
          </div>
        ) : undefined
      }
      identity={
        <>
          <h3 className="text-lg font-bold text-[var(--adm-ink)] break-words">{title}</h3>
          {description && (
            <p className="text-sm text-[var(--adm-muted)] break-words">{description}</p>
          )}
        </>
      }
      actions={actions}
    />
  );
}
