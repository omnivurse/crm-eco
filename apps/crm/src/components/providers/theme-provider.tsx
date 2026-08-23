'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useSyncExternalStore,
} from 'react';
import {
  THEME_STORAGE_KEY,
  isTheme,
  readStoredTheme,
  type Theme,
} from '@crm-eco/ui/lib/theme-boot';
import { supabase } from '@/lib/supabase-client';
import { useClientAuth } from '@/hooks/useClientAuth';
import { createThemeStore, type ThemeStore } from './theme-store';

interface ThemeProviderContextValue {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  isLoading: boolean;
}

/**
 * PI-1: the context carries the STORE, not the value. The store object is
 * created once per provider and never replaced, so this provider can never
 * invalidate a dehydrated Suspense boundary below it (see ./theme-store.ts for
 * the full explanation of why that mattered — it was silently client-rendering
 * the entire CRM shell on every page load).
 *
 * Exported so a test can observe the one thing that matters here: that the
 * value React sees on this context never changes identity. `useTheme` is the
 * only consumer application code should use.
 */
export const ThemeProviderContext = createContext<ThemeStore | undefined>(undefined);

/** Shared with the Admin console — see `@crm-eco/ui/lib/theme-boot`. */
const STORAGE_KEY = THEME_STORAGE_KEY;

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

export function ThemeProvider({
  children,
  defaultTheme = 'light',
  storageKey = STORAGE_KEY,
}: ThemeProviderProps) {
  const { profile: authProfile, user: authUser } = useClientAuth();

  // Created once (lazy useState) and never replaced. The seed is what the
  // server rendered, so the hydrating client render agrees. useState, not
  // useRef: the lint gate forbids reading a ref during render, and the
  // store IS needed during render — it is the context value.
  const [store] = useState<ThemeStore>(() =>
    createThemeStore({
      theme: defaultTheme,
      resolvedTheme: 'light',
      isLoading: true,
    }),
  );

  // Resolve system theme
  const getSystemTheme = useCallback((): 'light' | 'dark' => {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }, []);

  // Apply theme to document - only update if different to avoid flash
  const applyTheme = useCallback(
    (newTheme: Theme) => {
      const root = window.document.documentElement;
      const resolved = newTheme === 'system' ? getSystemTheme() : newTheme;

      // Only update DOM if the class is different (prevents flash on initial load)
      const currentTheme = root.classList.contains('dark') ? 'dark' : 'light';
      if (currentTheme !== resolved) {
        root.classList.remove('light', 'dark');
        root.classList.add(resolved);
      }
      store.setSnapshot({ resolvedTheme: resolved });
    },
    [getSystemTheme, store],
  );

  // Load theme from localStorage first (fast), then from authProfile (authoritative).
  // readStoredTheme() migrates a legacy `crm-theme` value into the shared key,
  // so an existing choice survives the switch. A caller that overrides
  // storageKey opts out of that migration and reads its own key directly.
  //
  // These writes go to the store (and the document class), never to React
  // state — so they cannot invalidate a dehydrated <Suspense> below us.
  useEffect(() => {
    const storedTheme =
      storageKey === THEME_STORAGE_KEY
        ? readStoredTheme()
        : (localStorage.getItem(storageKey) as Theme | null);
    if (isTheme(storedTheme)) {
      applyTheme(storedTheme);
      store.setSnapshot({ theme: storedTheme, isLoading: false });
    } else {
      applyTheme(defaultTheme);
      store.setSnapshot({ isLoading: false });
    }
  }, [storageKey, defaultTheme, applyTheme, store]);

  // Sync theme from profile if no localStorage value exists
  useEffect(() => {
    const storedTheme = localStorage.getItem(storageKey);
    if (!storedTheme && authProfile) {
      const loadThemeFromProfile = async () => {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('ui_theme')
            .eq('user_id', authProfile.user_id)
            .single();

          if (profile?.ui_theme && ['light', 'dark', 'system'].includes(profile.ui_theme)) {
            store.setSnapshot({ theme: profile.ui_theme as Theme });
            applyTheme(profile.ui_theme as Theme);
            localStorage.setItem(storageKey, profile.ui_theme);
          }
        } catch (error) {
          console.warn('Failed to load theme from profile:', error);
        }
      };
      loadThemeFromProfile();
    }
  }, [authProfile, storageKey, applyTheme, store]);

  // Listen for system theme changes. The handler reads the live theme from the
  // store, so the listener is registered once instead of re-registering on
  // every theme change.
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = () => {
      if (store.getSnapshot().theme === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [applyTheme, store]);

  // Set theme and persist to localStorage + DB. Installed on the store so
  // `useTheme().setTheme` keeps a stable identity across renders.
  const setTheme = useCallback(
    async (newTheme: Theme) => {
      store.setSnapshot({ theme: newTheme });
      applyTheme(newTheme);
      localStorage.setItem(storageKey, newTheme);

      // Persist to DB using authProfile user_id (avoids extra auth call)
      try {
        const userId = authProfile?.user_id || authUser?.id;
        if (userId) {
          await supabase.from('profiles').update({ ui_theme: newTheme }).eq('user_id', userId);
        }
      } catch (error) {
        console.warn('Failed to save theme to DB:', error);
      }
    },
    [storageKey, applyTheme, authProfile, authUser, store],
  );

  // Install on commit. ThemeToggle is click-driven; nothing in the tree
  // fires setTheme from a mount effect. A discarded concurrent render
  // therefore cannot leave a stale handler behind.
  useEffect(() => {
    store.setThemeHandler(setTheme);
    return () => store.setThemeHandler(() => {});
  }, [setTheme, store]);

  // Always render children - the script in layout.tsx handles initial theme class
  // This prevents blank page flash while still avoiding hydration mismatch
  return <ThemeProviderContext.Provider value={store}>{children}</ThemeProviderContext.Provider>;
}

export function useTheme(): ThemeProviderContextValue {
  const store = useContext(ThemeProviderContext);
  if (store === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  const { theme, resolvedTheme, isLoading } = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  return { theme, resolvedTheme, isLoading, setTheme: store.setTheme };
}
