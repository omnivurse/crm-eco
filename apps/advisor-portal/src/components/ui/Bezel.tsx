import { cn } from '@crm-eco/ui/lib/utils';

type BezelVariant = 'default' | 'deep' | 'sage';

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
        'adv-bezel h-full',
        variant === 'deep' && 'adv-bezel-deep',
        variant === 'sage' && 'adv-bezel-sage',
        className,
      )}
    >
      <div className={cn('adv-bezel-inner h-full', innerClassName)}>{children}</div>
    </div>
  );
}
