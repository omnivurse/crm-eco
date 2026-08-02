'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  THEME_STORAGE_KEY,
  isTheme,
  readStoredTheme,
  type Theme,
} from '@crm-eco/ui/lib/theme-boot';

interface ThemeProviderContextValue {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const ThemeProviderContext = createContext<ThemeProviderContextValue | undefined>(undefined);

/** Shared with the CRM console — see `@crm-eco/ui/lib/theme-boot`. */
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
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  const getSystemTheme = useCallback((): 'light' | 'dark' => {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }, []);

  const applyTheme = useCallback(
    (next: Theme) => {
      const resolved = next === 'system' ? getSystemTheme() : next;
      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(resolved);
      setResolvedTheme(resolved);
    },
    [getSystemTheme],
  );

  useEffect(() => {
    // readStoredTheme() migrates a legacy `admin-theme` value into the shared
    // key, so an existing choice survives the switch. A caller that overrides
    // storageKey opts out of that migration and reads its own key directly.
    const stored =
      storageKey === THEME_STORAGE_KEY
        ? readStoredTheme()
        : localStorage.getItem(storageKey);
    const initial = isTheme(stored) ? stored : defaultTheme;
    setThemeState(initial);
    applyTheme(initial);
  }, [storageKey, defaultTheme, applyTheme]);

  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme, applyTheme]);

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next);
      localStorage.setItem(storageKey, next);
      applyTheme(next);
    },
    [storageKey, applyTheme],
  );

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeProviderContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
