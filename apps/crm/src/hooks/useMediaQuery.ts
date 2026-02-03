'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for detecting media query matches.
 * Uses the browser's matchMedia API for efficient responsive behavior.
 * 
 * @param query - CSS media query string (e.g., '(max-width: 768px)')
 * @returns boolean indicating if the media query matches
 * 
 * @example
 * ```tsx
 * const isMobile = useMediaQuery('(max-width: 767px)');
 * const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
 * const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
 * ```
 */
export function useMediaQuery(query: string): boolean {
  // Initialize with false to avoid hydration mismatch (SSR always returns false)
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    // Check if window is available (client-side only)
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);
    
    // Set initial value
    setMatches(mediaQuery.matches);

    // Create listener function
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Add listener (modern API with fallback)
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
    }

    // Cleanup
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, [query]);

  return matches;
}

/**
 * Tailwind-aligned breakpoint values (in pixels).
 * These match the default Tailwind CSS breakpoints.
 */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

/**
 * Hook to detect if the viewport is mobile-sized (< 768px).
 * Useful for conditionally rendering mobile-specific components.
 * 
 * @returns boolean indicating if viewport is mobile-sized
 * 
 * @example
 * ```tsx
 * const isMobile = useIsMobile();
 * return isMobile ? <MobileNav /> : <DesktopNav />;
 * ```
 */
export function useIsMobile(): boolean {
  return useMediaQuery(`(max-width: ${BREAKPOINTS.md - 1}px)`);
}

/**
 * Hook to detect if the viewport is tablet-sized (768px - 1023px).
 * 
 * @returns boolean indicating if viewport is tablet-sized
 */
export function useIsTablet(): boolean {
  return useMediaQuery(
    `(min-width: ${BREAKPOINTS.md}px) and (max-width: ${BREAKPOINTS.lg - 1}px)`
  );
}

/**
 * Hook to detect if the viewport is desktop-sized (>= 1024px).
 * 
 * @returns boolean indicating if viewport is desktop-sized
 */
export function useIsDesktop(): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINTS.lg}px)`);
}

/**
 * Hook to detect if the viewport is at least a certain breakpoint.
 * Follows Tailwind's mobile-first approach (min-width).
 * 
 * @param breakpoint - The minimum breakpoint ('sm' | 'md' | 'lg' | 'xl' | '2xl')
 * @returns boolean indicating if viewport is at least the specified breakpoint
 * 
 * @example
 * ```tsx
 * const isAtLeastMd = useBreakpoint('md');
 * const isAtLeastLg = useBreakpoint('lg');
 * ```
 */
export function useBreakpoint(
  breakpoint: keyof typeof BREAKPOINTS
): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINTS[breakpoint]}px)`);
}

/**
 * Hook to detect if the user prefers reduced motion.
 * Useful for disabling animations for accessibility.
 * 
 * @returns boolean indicating if user prefers reduced motion
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/**
 * Hook to detect if the user prefers dark color scheme.
 * 
 * @returns boolean indicating if user prefers dark mode
 */
export function usePrefersDarkMode(): boolean {
  return useMediaQuery('(prefers-color-scheme: dark)');
}

/**
 * Hook that returns the current breakpoint name based on viewport width.
 * Useful for debugging or conditional logic based on multiple breakpoints.
 * 
 * @returns The current breakpoint name or 'xs' for below 'sm'
 * 
 * @example
 * ```tsx
 * const breakpoint = useCurrentBreakpoint();
 * console.log(breakpoint); // 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
 * ```
 */
export function useCurrentBreakpoint(): 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' {
  const is2xl = useBreakpoint('2xl');
  const isXl = useBreakpoint('xl');
  const isLg = useBreakpoint('lg');
  const isMd = useBreakpoint('md');
  const isSm = useBreakpoint('sm');

  if (is2xl) return '2xl';
  if (isXl) return 'xl';
  if (isLg) return 'lg';
  if (isMd) return 'md';
  if (isSm) return 'sm';
  return 'xs';
}
