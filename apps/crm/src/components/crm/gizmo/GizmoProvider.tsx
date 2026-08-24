'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import type { GizmoContextValue, GizmoPersistedState, GizmoTip } from './gizmo-types';
import { getTipSetForPath } from './gizmo-tips';

const STORAGE_KEY_PREFIX = 'gizmo_state';

const DEFAULT_STATE: GizmoPersistedState = {
  enabled: true,
  dismissedTipIds: [],
  welcomeCompleted: false,
};

/** Shared so a route with no tips does not mint a new array on every render. */
const NO_TIPS: GizmoTip[] = [];

const GizmoContext = createContext<GizmoContextValue | undefined>(undefined);

interface GizmoProviderProps {
  children: ReactNode;
  profileId?: string;
}

export function GizmoProvider({ children, profileId }: GizmoProviderProps) {
  const pathname = usePathname();
  const storageKey = profileId ? `${STORAGE_KEY_PREFIX}_${profileId}` : STORAGE_KEY_PREFIX;

  const [persisted, setPersisted] = useState<GizmoPersistedState>(DEFAULT_STATE);
  const [isOpen, setIsOpen] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<GizmoPersistedState>;
        setPersisted((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // localStorage unavailable or corrupt
    }
  }, [storageKey]);

  const persist = useCallback(
    (next: GizmoPersistedState) => {
      setPersisted(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // localStorage full or unavailable
      }
    },
    [storageKey]
  );

  // Route-derived tip state (safe — never throws during SSR)
  const match = useMemo(() => {
    try {
      return getTipSetForPath(pathname ?? '');
    } catch {
      return null;
    }
  }, [pathname]);

  // `?? []` minted a new array on every render, so `currentTips` and then the
  // context `value` changed identity every single render — and this provider
  // sits above the page-level `<Suspense>` boundaries, where a changed ancestor
  // context makes React discard the dehydrated server HTML and client-render
  // the page. One shared empty array keeps the identity stable on the (common)
  // no-tips routes.
  const allCurrentTips: GizmoTip[] = match?.tipSet.tips ?? NO_TIPS;
  const currentPageLabel = match?.tipSet.pageLabel ?? null;

  const currentTips = useMemo(
    () => allCurrentTips.filter((t) => !persisted.dismissedTipIds.includes(t.id)),
    [allCurrentTips, persisted.dismissedTipIds]
  );

  const hasNewTips = currentTips.length > 0;

  // Close popover on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const setEnabled = useCallback(
    (enabled: boolean) => persist({ ...persisted, enabled }),
    [persisted, persist]
  );

  const dismissTip = useCallback(
    (tipId: string) => {
      if (persisted.dismissedTipIds.includes(tipId)) return;
      persist({
        ...persisted,
        dismissedTipIds: [...persisted.dismissedTipIds, tipId],
      });
    },
    [persisted, persist]
  );

  const dismissAllCurrentTips = useCallback(() => {
    const ids = allCurrentTips.map((t) => t.id);
    const merged = Array.from(new Set([...persisted.dismissedTipIds, ...ids]));
    persist({ ...persisted, dismissedTipIds: merged });
  }, [allCurrentTips, persisted, persist]);

  const resetAllTips = useCallback(
    () => persist({ ...persisted, dismissedTipIds: [], welcomeCompleted: false }),
    [persisted, persist]
  );

  const value = useMemo<GizmoContextValue>(
    () => ({
      enabled: persisted.enabled,
      setEnabled,
      currentTips,
      allCurrentTips,
      currentPageLabel,
      dismissTip,
      dismissAllCurrentTips,
      resetAllTips,
      hasNewTips,
      isOpen,
      setIsOpen,
    }),
    [
      persisted.enabled,
      setEnabled,
      currentTips,
      allCurrentTips,
      currentPageLabel,
      dismissTip,
      dismissAllCurrentTips,
      resetAllTips,
      hasNewTips,
      isOpen,
    ]
  );

  return <GizmoContext.Provider value={value}>{children}</GizmoContext.Provider>;
}

export function useGizmo() {
  const context = useContext(GizmoContext);
  if (!context) {
    throw new Error('useGizmo must be used within GizmoProvider');
  }
  return context;
}

/** Safe version that returns null instead of throwing when outside GizmoProvider */
export function useGizmoSafe() {
  return useContext(GizmoContext);
}
