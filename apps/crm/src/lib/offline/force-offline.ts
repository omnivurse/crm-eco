'use client';

/**
 * Optional "simulate offline" mode for CRM testing and demos.
 *
 * When enabled, the offline stack treats the session as disconnected even if
 * `navigator.onLine` is true. Does not affect the OS or browser — only this app.
 */

export const FORCE_OFFLINE_STORAGE_KEY = 'crm.forceOffline.v1';
export const FORCE_OFFLINE_CHANGED_EVENT = 'crm-force-offline-changed';

export function getForceOffline(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(FORCE_OFFLINE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setForceOffline(value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (value) window.localStorage.setItem(FORCE_OFFLINE_STORAGE_KEY, '1');
    else window.localStorage.removeItem(FORCE_OFFLINE_STORAGE_KEY);
  } catch {
    /* quota / private mode */
  }
  window.dispatchEvent(new Event(FORCE_OFFLINE_CHANGED_EVENT));
}

/** True when the browser reports online and simulate-offline is off. */
export function isEffectiveOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine && !getForceOffline();
}
