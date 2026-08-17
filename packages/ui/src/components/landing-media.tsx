import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

export interface LandingMediaProps {
  children: ReactNode;
  aspect?: '4/3' | '16/9';
  className?: string;
}

export function LandingMedia({
  children,
  aspect = '4/3',
  className,
}: LandingMediaProps) {
  return (
    <figure
      className={cn(
        'lp-media',
        aspect === '16/9' ? 'lp-media-wide' : 'lp-media-frame',
        className,
      )}
    >
      {children}
    </figure>
  );
}
