'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { DENSITY_STORAGE_KEY, LEGACY_DENSITY_STORAGE_KEYS } from './theme-boot';

/**
 * Global display-density store, shared by the CRM and Admin operator consoles.
 *
 * Density drives the app-wide `html[data-density]` attribute, which the shared
 * `--ui-*` scale keys off — chrome heights, gutters, section gaps, row height
 * and cell padding (see the density blocks in @crm-eco/ui/styles/theme.css).
 * 'default' means no attribute (the base scale); 'compact' / 'comfortable' opt
 * into the denser / roomier token sets.
 *
 * Persisted to localStorage and applied pre-paint by the boot script in
 * `theme-boot`, so the chosen density paints on the very first frame with no
 * flash. This module is the runtime half: it keeps the DOM attribute,
 * localStorage and React state in sync when the user flips the toggle.
 *
 * Promoted out of apps/crm — the Admin console had no density support at all
 * despite owning the densest tables in the suite.
 */

export type Density = 'compact' | 'default' | 'comfortable';

export { DENSITY_STORAGE_KEY };

const listeners = new Set<() => void>();
let cached: Density | null = null;

function isDensity(value: unknown): value is Density {
  return value === 'compact' || value === 'default' || value === 'comfortable';
}

function readFromDom(): Density {
  if (typeof document === 'undefined') return 'default';
  const attr = document.documentElement.getAttribute('data-density');
  return attr === 'compact' || attr === 'comfortable' ? attr : 'default';
}

function applyToDom(density: Density): void {
  const html = document.documentElement;
  if (density === 'compact' || density === 'comfortable') {
    html.setAttribute('data-density', density);
  } else {
    // 'default' resolves to the base :root token scale — no attribute needed.
    html.removeAttribute('data-density');
  }
}

/**
 * Read the persisted density, migrating a legacy per-app value into the shared
 * key when found. Mainly for callers that need the stored value before paint;
 * the boot script performs the same migration.
 */
export function readStoredDensity(): Density | null {
  if (typeof window === 'undefined') return null;
  try {
    const current = window.localStorage.getItem(DENSITY_STORAGE_KEY);
    if (isDensity(current)) return current;

    for (const legacyKey of LEGACY_DENSITY_STORAGE_KEYS) {
      const legacy = window.localStorage.getItem(legacyKey);
      if (isDensity(legacy)) {
        window.localStorage.setItem(DENSITY_STORAGE_KEY, legacy);
        return legacy;
      }
    }
  } catch {
    // Storage unavailable — the DOM attribute still governs this session.
  }
  return null;
}

/** Set the global density: update the DOM attribute, persist, notify subscribers. */
export function setDensity(density: Density): void {
  if (typeof document === 'undefined') return;
  cached = density;
  applyToDom(density);
  try {
    localStorage.setItem(DENSITY_STORAGE_KEY, density);
  } catch {
    /* private mode / storage disabled — the DOM attribute still applies */
  }
  listeners.forEach((notify) => notify());
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

function getSnapshot(): Density {
  if (cached === null) cached = readFromDom();
  return cached;
}

function getServerSnapshot(): Density {
  // Must match the pre-paint default in the boot script: users with no saved
  // preference get 'compact'. Returning 'default' here caused a one-frame
  // density flip on hydrate that reflowed the whole chrome and looked like the
  // dashboard was shaking after login.
  return 'compact';
}

/**
 * Read + set the global display density. The chrome (CSS, keyed off the
 * pre-paint `html[data-density]` attribute) is already correct on first paint;
 * this hook keeps React-driven consumers (the toggle's label, table padding
 * variants) in sync after hydration.
 */
export function useDensity(): { density: Density; setDensity: (density: Density) => void } {
  const density = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const set = useCallback((next: Density) => setDensity(next), []);
  return { density, setDensity: set };
}
