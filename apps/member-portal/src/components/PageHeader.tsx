import Link from 'next/link';
import { CaretLeft } from '@phosphor-icons/react/dist/ssr';
import { cn } from '@crm-eco/ui/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  kicker?: string;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  kicker,
  backHref,
  backLabel = 'Back',
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('mb-6 md:mb-8', className)}>
      {backHref && (
        <Link
          href={backHref}
          className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--mp-teal)] transition-opacity hover:opacity-80"
        >
          <CaretLeft weight="light" className="h-4 w-4" aria-hidden />
          {backLabel}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {kicker && <p className="mp-kicker mp-kicker-teal">{kicker}</p>}
          <h1 className="text-2xl font-bold tracking-[-0.03em] text-[var(--mp-ink)] md:text-[1.75rem]">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500 md:text-[0.95rem]">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
