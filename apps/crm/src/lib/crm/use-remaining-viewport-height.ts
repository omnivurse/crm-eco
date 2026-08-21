'use client';

import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import {
  VIEWPORT_FILL_BOTTOM_GAP,
  remainingViewportHeight,
} from './remaining-viewport-height';

const useIsomorphicLayoutEffect = typeof document !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Live remaining-viewport height for a workspace row. Re-measures on resize
 * and when chrome above the row reflows (toolbar wrap, chips, rail).
 */
export function useRemainingViewportHeight(
  ref: RefObject<HTMLElement | null>,
  bottomGap = VIEWPORT_FILL_BOTTOM_GAP,
): number | null {
  const [height, setHeight] = useState<number | null>(null);

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof window === 'undefined') return;

    const measure = () => {
      const next = remainingViewportHeight(
        el.getBoundingClientRect().top,
        window.innerHeight,
        bottomGap,
      );
      setHeight((prev) => (prev === next ? prev : next));
    };

    measure();
    window.addEventListener('resize', measure);
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    ro.observe(el);
    return () => {
      window.removeEventListener('resize', measure);
      ro.disconnect();
    };
  }, [ref, bottomGap]);

  return height;
}
