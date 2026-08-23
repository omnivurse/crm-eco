/**
 * PI-1 — the theme store exists so `ThemeProvider` can publish theme changes
 * WITHOUT ever handing React a new context value. See ./theme-store.ts for why
 * that mattered (a changed context above a dehydrated <Suspense> makes React
 * throw the server HTML away, which is what broke `useId` across the CRM shell).
 *
 * These tests pin the three properties the fix depends on:
 *   · the snapshot is cached — `getSnapshot()` returns the SAME object until
 *     something actually changes, or `useSyncExternalStore` loops forever;
 *   · a no-op write notifies nobody, so a re-render storm cannot restart;
 *   · the hydrating render always sees the server snapshot.
 */
import { describe, expect, it, vi } from 'vitest';
import { createThemeStore, type ThemeSnapshot } from './theme-store';

const seed: ThemeSnapshot = { theme: 'light', resolvedTheme: 'light', isLoading: true };

describe('createThemeStore', () => {
  it('returns the identical snapshot object until something changes', () => {
    const store = createThemeStore(seed);
    const first = store.getSnapshot();
    expect(store.getSnapshot()).toBe(first);

    store.setSnapshot({ isLoading: false });
    const second = store.getSnapshot();
    expect(second).not.toBe(first);
    expect(second).toEqual({ theme: 'light', resolvedTheme: 'light', isLoading: false });
    expect(store.getSnapshot()).toBe(second);
  });

  it('does not notify — or replace the snapshot — on a write that changes nothing', () => {
    const store = createThemeStore(seed);
    const listener = vi.fn();
    store.subscribe(listener);

    const before = store.getSnapshot();
    store.setSnapshot({ theme: 'light' });
    store.setSnapshot({ theme: 'light', resolvedTheme: 'light', isLoading: true });
    store.setSnapshot({});

    expect(listener).not.toHaveBeenCalled();
    expect(store.getSnapshot()).toBe(before);
  });

  it('notifies every subscriber once per real change, and stops after unsubscribe', () => {
    const store = createThemeStore(seed);
    const a = vi.fn();
    const b = vi.fn();
    const unsubscribeA = store.subscribe(a);
    store.subscribe(b);

    store.setSnapshot({ theme: 'dark' });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    unsubscribeA();
    store.setSnapshot({ resolvedTheme: 'dark' });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });

  it('survives a listener that unsubscribes while it is being notified', () => {
    const store = createThemeStore(seed);
    const later = vi.fn();
    const unsubscribeSelf = store.subscribe(() => unsubscribeSelf());
    store.subscribe(later);

    expect(() => store.setSnapshot({ theme: 'dark' })).not.toThrow();
    expect(later).toHaveBeenCalledTimes(1);
  });

  it('keeps the server snapshot frozen so the hydrating render matches the HTML', () => {
    const store = createThemeStore(seed);
    const server = store.getServerSnapshot();

    store.setSnapshot({ theme: 'dark', resolvedTheme: 'dark', isLoading: false });

    expect(store.getServerSnapshot()).toBe(server);
    expect(server).toEqual(seed);
    expect(store.getSnapshot()).not.toBe(server);
  });

  it('keeps setTheme referentially stable while delegating to the installed handler', () => {
    const store = createThemeStore(seed);
    const setTheme = store.setTheme;

    // Nothing installed yet: a consumer that fires on mount must not throw.
    expect(() => setTheme('dark')).not.toThrow();

    const first = vi.fn();
    store.setThemeHandler(first);
    setTheme('dark');
    expect(first).toHaveBeenCalledWith('dark');

    const second = vi.fn();
    store.setThemeHandler(second);
    setTheme('system');
    expect(second).toHaveBeenCalledWith('system');
    expect(first).toHaveBeenCalledTimes(1);
    // The function the consumer captured is still the one the store exposes.
    expect(store.setTheme).toBe(setTheme);
  });
});
