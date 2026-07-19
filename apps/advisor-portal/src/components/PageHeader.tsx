import { cn } from '@crm-eco/ui/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  kicker?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  kicker,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('mb-6 md:mb-8', className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {kicker && <p className="adv-kicker mb-3">{kicker}</p>}
          <h1 className="adv-display text-2xl font-semibold tracking-[-0.03em] text-[var(--adv-ink)] md:text-[1.85rem]">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[var(--adv-slate)] md:text-[0.95rem]">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
