import { cn } from '@crm-eco/ui/lib/utils';

type BezelVariant = 'default' | 'hero' | 'deep';

interface BezelProps {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  variant?: BezelVariant;
}

export function Bezel({
  children,
  className,
  innerClassName,
  variant = 'default',
}: BezelProps) {
  return (
    <div
      className={cn(
        'mp-bezel h-full',
        variant === 'hero' && 'mp-bezel-hero',
        variant === 'deep' && 'mp-bezel-deep',
        className,
      )}
    >
      <div className={cn('mp-bezel-inner h-full', innerClassName)}>{children}</div>
    </div>
  );
}
