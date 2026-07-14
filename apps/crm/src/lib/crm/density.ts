'use client';

import { useCallback, useSyncExternalStore } from 'react';
import type { Density } from '@/components/zoho/ViewPreferencesContext';

/**
 * Global CRM display-density store.
 *
 * Density drives the app-wide `html[data-density]` attribute, which the CRM
 * design tokens key off — chrome heights, gutters, section gaps, row/cell
 * padding (see the density blocks in apps/crm/src/app/globals.css). 'default'
 * means no attribute (the base comfortable-dense scale); 'compact' /
 * 'comfortable' opt into the denser / roomier token sets.
 *
 * Persisted to localStorage and applied pre-hydration by the inline script in
 * app/layout.tsx, so the chosen density paints on the very first frame (no
 * flash). This module is the runtime half: it keeps the DOM attribute,
 * localStorage, and React state in sync when the user flips the DensityToggle.
 */

export const CRM_DENSITY_STORAGE_KEY = 'crm-density';

const listeners = new Set<() => void>();
let cached: Density | null = null;

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

/** Set the global density: update the DOM attribute, persist, and notify subscribers. */
export function setCrmDensity(density: Density): void {
  if (typeof document === 'undefined') return;
  cached = density;
  applyToDom(density);
  try {
    localStorage.setItem(CRM_DENSITY_STORAGE_KEY, density);
  } catch {
    /* private mode / storage disabled — the DOM attribute still applies for this session */
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
  // The server can't know the client's localStorage; it always renders as the
  // base scale. useSyncExternalStore uses this during hydration (matching SSR),
  // then adopts the real client value — set pre-hydration on <html> — without a
  // hydration mismatch.
  return 'default';
}

/**
 * Read + set the global display density. The chrome (CSS, keyed off the
 * pre-hydration `html[data-density]` attribute) is already correct on first
 * paint; this hook keeps React-driven consumers (the toggle's label, the table
 * padding variants) in sync after hydration.
 */
export function useCrmDensity(): { density: Density; setDensity: (density: Density) => void } {
  const density = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setDensity = useCallback((next: Density) => setCrmDensity(next), []);
  return { density, setDensity };
}
