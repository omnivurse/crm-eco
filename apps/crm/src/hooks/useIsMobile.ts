'use client';

/**
 * useIsMobile — small media-query hook that returns `true` when the viewport
 * is narrower than the supplied breakpoint (defaults to Tailwind's `md`).
 *
 * Avoids SSR-hydration flash by returning `null` until the effect runs the
 * first time. Callers should treat `null` as "unknown / desktop-ish" so the
 * mobile-only UI never flashes during server render.
 *
 * Usage:
 *   const isMobile = useIsMobile();
 *   if (isMobile) { … }
 */

import { useEffect, useState } from 'react';

export function useIsMobile(breakpointPx = 768): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);

    const handler = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile('matches' in event ? event.matches : mq.matches);
    };

    handler(mq);

    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', handler as (e: MediaQueryListEvent) => void);
      return () =>
        mq.removeEventListener('change', handler as (e: MediaQueryListEvent) => void);
    }

    mq.addListener(handler as (e: MediaQueryListEvent) => void);
    return () => mq.removeListener(handler as (e: MediaQueryListEvent) => void);
  }, [breakpointPx]);

  return isMobile;
}
