'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { CaretLeft } from '@phosphor-icons/react';
import { IdentityActionsHeader } from '@crm-eco/ui/components/identity-actions-header';
import { cn } from '@crm-eco/ui';

/**
 * Entity / record page chrome for admin detail views.
 * Signature: one-scan identity — title, status, primary action —
 * with overflow-safe action wrapping via IdentityActionsHeader.
 */
export interface EntityPageHeaderProps {
  backHref: string;
  backLabel?: string;
  title: string;
  /** Secondary identity line (plan code, email, id). */
  subtitle?: ReactNode;
  /** Status / model chips under the title. */
  badges?: ReactNode;
  /** Optional one-line description under badges. */
  description?: string;
  /** Primary CTA (Edit, Save, etc.) — keep to one. */
  primaryAction?: ReactNode;
  /** Secondary / tertiary controls; wrap safely. */
  secondaryActions?: ReactNode;
  className?: string;
}

export function EntityPageHeader({
  backHref,
  backLabel = 'Back',
  title,
  subtitle,
  badges,
  description,
  primaryAction,
  secondaryActions,
  className,
}: EntityPageHeaderProps) {
  const hasActions = primaryAction != null || secondaryActions != null;

  return (
    <header className={cn('mb-6 space-y-3', className)}>
      <Link
        href={backHref}
        className="group inline-flex items-center gap-1.5 text-sm text-[var(--adm-muted)] transition-colors hover:text-[var(--adm-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--adm-cyan)] focus-visible:ring-offset-2 rounded-sm"
      >
        <CaretLeft
          weight="light"
          className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
          aria-hidden
        />
        {backLabel}
      </Link>

      <IdentityActionsHeader
        breakpoint="lg"
        align="start"
        identity={
          <div className="min-w-0 space-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight text-[var(--adm-ink)] sm:text-2xl break-words">
              {title}
            </h1>
            {subtitle != null && (
              <div className="text-sm text-[var(--adm-muted)] break-words">{subtitle}</div>
            )}
            {badges != null && (
              <div className="flex flex-wrap items-center gap-2 pt-0.5">{badges}</div>
            )}
            {description ? (
              <p className="max-w-2xl text-sm leading-relaxed text-[var(--adm-muted)] pt-1">
                {description}
              </p>
            ) : null}
          </div>
        }
        actions={
          hasActions ? (
            <>
              {secondaryActions}
              {primaryAction}
            </>
          ) : undefined
        }
        actionsClassName="gap-2"
      />
    </header>
  );
}
