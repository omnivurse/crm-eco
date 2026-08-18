'use client';

/**
 * Landing motion primitives.
 *
 * Dependency-free on purpose: @crm-eco/ui must stay light, so this uses only
 * React + platform APIs (matchMedia / IntersectionObserver / rAF). Both apps
 * have framer-motion, but the package does not and should not.
 *
 * Everything here is progressive enhancement: components must already look
 * finished with `progress = 0` and no JS at all.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia(REDUCED_MOTION_QUERY);
  mq.addEventListener('change', onStoreChange);
  return () => mq.removeEventListener('change', onStoreChange);
}

function getReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/**
 * True when the visitor asked for reduced motion. SSR-safe: returns `false`
 * on the server and on first client paint, then corrects after mount, so it
 * never causes a hydration mismatch.
 */
export function usePrefersReducedMotion(): boolean {
  // useSyncExternalStore rather than setState-in-effect: matchMedia IS an
  // external store, and the effect form both trips react-hooks lint and
  // renders one extra time on every mount.
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false);
}

/** Never changes after subscribe — mounted is a one-way transition. */
function subscribeMounted(): () => void {
  return () => {};
}

/** True once the component has mounted on the client. */
export function useMounted(): boolean {
  // The server snapshot is false and the client snapshot is true, which is
  // exactly the hydration-guard semantics, without a mount-time setState.
  return useSyncExternalStore(
    subscribeMounted,
    () => true,
    () => false,
  );
}

export interface ScrollProgressOptions {
  /**
   * Fraction of the viewport height at which the element's top counts as
   * "started". 0.9 = progress begins when the element enters the lower 10%.
   */
  start?: number;
  /**
   * Fraction of the viewport height at which the element's bottom counts as
   * "finished". 0.25 = progress completes once the bottom passes the upper
   * quarter of the viewport.
   */
  end?: number;
  /** Skip all listeners and hold progress at 0 (used for reduced motion). */
  disabled?: boolean;
}

/**
 * Progress (0..1) of an element travelling through the viewport.
 *
 * The scroll listener is only attached while the element is actually on
 * screen (IntersectionObserver gate), and reads are rAF-batched, so the whole
 * thing costs nothing when the section is parked off screen.
 *
 * Returns 0 on the server and until the first measurement.
 */
export function useScrollProgress<T extends HTMLElement>(
  options: ScrollProgressOptions = {},
): { ref: React.RefObject<T | null>; progress: number } {
  const { start = 0.88, end = 0.32, disabled = false } = options;
  const ref = useRef<T | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (disabled || !node || typeof window === 'undefined') return;

    let frame = 0;
    let listening = false;
    let last = -1;

    const measure = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const from = vh * start;
      const span = rect.height + (vh * start - vh * end);
      const raw = span <= 0 ? 1 : (from - rect.top) / span;
      const next = Math.min(1, Math.max(0, raw));
      // Quantise: 250 steps is finer than the eye, coarse enough to skip
      // most re-renders.
      const stepped = Math.round(next * 250) / 250;
      if (stepped !== last) {
        last = stepped;
        setProgress(stepped);
      }
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };

    const listen = (on: boolean) => {
      if (on === listening) return;
      listening = on;
      if (on) {
        window.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', schedule);
        schedule();
      } else {
        window.removeEventListener('scroll', schedule);
        window.removeEventListener('resize', schedule);
      }
    };

    let observer: IntersectionObserver | undefined;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          listen(Boolean(entry?.isIntersecting));
          // Settle the final value when the section leaves upward.
          if (entry && !entry.isIntersecting) schedule();
        },
        { rootMargin: '20% 0px 20% 0px' },
      );
      observer.observe(node);
    } else {
      listen(true);
    }

    schedule();

    return () => {
      observer?.disconnect();
      listen(false);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [start, end, disabled]);

  return { ref, progress };
}

/** Clamp helper shared by the landing components. */
export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
