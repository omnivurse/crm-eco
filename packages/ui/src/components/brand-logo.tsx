import * as React from 'react';
import { cn } from '../lib/utils';

/**
 * Double Helix Hub brand mark.
 *
 * Renders the transparent-PNG wordmark or the standalone helix icon at a set of
 * standardized, height-driven sizes. The assets live in each app's `public/`:
 *   /logo.png        full color wordmark (light surfaces)
 *   /logo-white.png  full white wordmark (dark surfaces)
 *   /logo-icon.png   helix mark, square (light + dark)
 *
 * Tone:
 *   - `auto` (default): color in light mode, white in dark mode (class-based).
 *   - `color` / `white`: force a single tone for fixed-background surfaces
 *     (e.g. an always-dark auth panel, or a logo sitting inside a white chip).
 */
export type BrandLogoVariant = 'full' | 'icon';
export type BrandLogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type BrandLogoTone = 'auto' | 'color' | 'white';

export interface BrandLogoProps {
  variant?: BrandLogoVariant;
  size?: BrandLogoSize;
  /** Only applies to `variant="full"`. */
  tone?: BrandLogoTone;
  /** Eager-load with high fetch priority for above-the-fold marks. */
  priority?: boolean;
  alt?: string;
  className?: string;
}

// Height-driven presets; full wordmark keeps `w-auto`, icon stays square.
const FULL_SIZE: Record<BrandLogoSize, string> = {
  xs: 'h-8',
  sm: 'h-8 lg:h-9',
  md: 'h-10',
  lg: 'h-14',
  xl: 'h-16',
};

const ICON_SIZE: Record<BrandLogoSize, string> = {
  xs: 'h-8 w-8',
  sm: 'h-9 w-9',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
  xl: 'h-16 w-16',
};

// Intrinsic dimensions of the generated assets — set as width/height attrs so the
// browser reserves the correct aspect ratio (no layout shift) while CSS drives size.
const FULL_W = 1024;
const FULL_H = 415;
const ICON_DIM = 256;

export function BrandLogo({
  variant = 'full',
  size = 'sm',
  tone = 'auto',
  priority = false,
  alt = 'Double Helix Hub',
  className,
}: BrandLogoProps) {
  const loading = priority ? 'eager' : 'lazy';
  const fetchPriority = priority ? 'high' : 'auto';

  if (variant === 'icon') {
    return (
      <img
        src="/logo-icon.png"
        alt={alt}
        width={ICON_DIM}
        height={ICON_DIM}
        loading={loading}
        fetchPriority={fetchPriority}
        decoding="async"
        className={cn('object-contain', ICON_SIZE[size], className)}
      />
    );
  }

  const base = cn('object-contain w-auto', FULL_SIZE[size], className);

  if (tone !== 'auto') {
    return (
      <img
        src={tone === 'white' ? '/logo-white.png' : '/logo.png'}
        alt={alt}
        width={FULL_W}
        height={FULL_H}
        loading={loading}
        fetchPriority={fetchPriority}
        decoding="async"
        className={base}
      />
    );
  }

  // Auto: color for light mode, white for dark mode. Only the visible image is
  // in the accessibility tree (the hidden one is `display:none`), so both carry
  // the same alt without double-announcing.
  return (
    <>
      <img
        src="/logo.png"
        alt={alt}
        width={FULL_W}
        height={FULL_H}
        loading={loading}
        fetchPriority={fetchPriority}
        decoding="async"
        className={cn(base, 'block dark:hidden')}
      />
      <img
        src="/logo-white.png"
        alt={alt}
        width={FULL_W}
        height={FULL_H}
        loading={loading}
        fetchPriority="auto"
        decoding="async"
        className={cn(base, 'hidden dark:block')}
      />
    </>
  );
}
