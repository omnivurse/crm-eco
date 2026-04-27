import Link from 'next/link';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const buttonStyles = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-helix-cyan-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-white text-ink-950 hover:bg-helix-cyan-100 shadow-[0_10px_40px_-12px_rgba(13,190,235,0.55)]',
        helix:
          'text-white bg-gradient-to-r from-helix-cyan-500 to-helix-violet-500 hover:from-helix-cyan-400 hover:to-helix-violet-400 shadow-[0_10px_40px_-12px_rgba(111,91,255,0.65)]',
        ghost:
          'border border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06] hover:border-white/20',
        outline:
          'border border-white/15 text-white hover:bg-white/5',
        link:
          'text-helix-cyan-200 hover:text-helix-cyan-100 underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 px-3.5 text-[13px]',
        md: 'h-11 px-5',
        lg: 'h-12 px-6 text-[15px]',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

type ButtonAsLinkProps = {
  href: string;
  external?: boolean;
} & VariantProps<typeof buttonStyles> & {
    children: React.ReactNode;
    className?: string;
  };

type ButtonAsButtonProps = {
  href?: undefined;
  type?: 'button' | 'submit' | 'reset';
  onClick?: () => void;
} & VariantProps<typeof buttonStyles> & {
    children: React.ReactNode;
    className?: string;
    disabled?: boolean;
  };

export function Button(props: ButtonAsLinkProps | ButtonAsButtonProps) {
  const { variant, size, className, children } = props;
  const cls = cn(buttonStyles({ variant, size }), className);

  if ('href' in props && props.href) {
    if (props.external) {
      return (
        <a href={props.href} target="_blank" rel="noopener noreferrer" className={cls}>
          {children}
        </a>
      );
    }
    return (
      <Link href={props.href} className={cls}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={(props as ButtonAsButtonProps).type ?? 'button'}
      onClick={(props as ButtonAsButtonProps).onClick}
      disabled={(props as ButtonAsButtonProps).disabled}
      className={cls}
    >
      {children}
    </button>
  );
}
