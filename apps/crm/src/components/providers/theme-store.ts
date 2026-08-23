/**
 * The theme's live value, held OUTSIDE React state.
 *
 * PI-1 — why this exists. `ThemeProvider` sits in the root layout, above the
 * `<Suspense fallback={<CrmShellSkeleton/>}>` that `/crm/layout.tsx` wraps
 * around the authed shell. That boundary always streams (the shell awaits
 * `loadCrmSession()`), so React commits the document first and hydrates the
 * boundary a moment later. While the boundary is still dehydrated, React
 * checks whether anything above it changed — `updateDehydratedSuspenseComponent`
 * → `propagateParentContextChanges` — and if ANY ancestor context provider has
 * a new value, it throws the server HTML away and client-renders the whole
 * subtree ("this boundary has changed since the first render", React 19).
 *
 * The old provider changed its context value four times on mount (mounted,
 * theme, resolvedTheme, isLoading), so the entire CRM shell was re-rendered
 * from scratch on every load. Every `useId()` inside then fell into React's
 * non-hydrating branch (`_r_<counter>` instead of `_R_<treeId>`), so each Radix
 * `id` / `aria-controls` disagreed with the HTML the server had sent — the
 * "some attributes of the server rendered HTML didn't match … won't be patched
 * up" error on eight shell controls, and broken aria wiring in real browsers.
 *
 * So the context value must be referentially STABLE for the whole life of the
 * provider. It is this store: consumers subscribe with `useSyncExternalStore`,
 * which re-renders only them, only after they have hydrated.
 */
import type { Theme } from '@crm-eco/ui/lib/theme-boot';

export interface ThemeSnapshot {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  /** True until the persisted choice has been read on the client. */
  isLoading: boolean;
}

export interface ThemeStore {
  subscribe: (onChange: () => void) => () => void;
  /** Cached — returns the SAME object until something actually changes. */
  getSnapshot: () => ThemeSnapshot;
  /** What the server rendered; also the client's first (hydrating) render. */
  getServerSnapshot: () => ThemeSnapshot;
  /** Publish a change. A no-op write notifies nobody. */
  setSnapshot: (patch: Partial<ThemeSnapshot>) => void;
  /** Stable identity; delegates to whatever the provider installed. */
  setTheme: (theme: Theme) => void;
  /** Provider-only: install the real `setTheme` behaviour. */
  setThemeHandler: (handler: (theme: Theme) => void) => void;
}

export function createThemeStore(serverSnapshot: ThemeSnapshot): ThemeStore {
  const server = serverSnapshot;
  let snapshot = serverSnapshot;
  const listeners = new Set<() => void>();
  let handler: (theme: Theme) => void = () => {};

  return {
    subscribe(onChange) {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => server,
    setSnapshot(patch) {
      const next: ThemeSnapshot = { ...snapshot, ...patch };
      if (
        next.theme === snapshot.theme &&
        next.resolvedTheme === snapshot.resolvedTheme &&
        next.isLoading === snapshot.isLoading
      ) {
        return;
      }
      snapshot = next;
      // Copy first: a listener may unsubscribe while we are notifying.
      for (const listener of [...listeners]) listener();
    },
    setTheme(theme) {
      handler(theme);
    },
    setThemeHandler(next) {
      handler = next;
    },
  };
}
