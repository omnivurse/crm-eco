'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

export type Theme = 'light' | 'dark';

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = 'dh-theme';

/**
 * The theme is an EXTERNAL store, not React state: the source of truth is the
 * `dark` class on <html>, which `themeInitScript` below stamps on before React
 * ever runs so the page never flashes the wrong ground.
 *
 * It is read with `useSyncExternalStore` rather than mirrored into `useState`
 * inside a mount effect. The effect version tripped `react-hooks/
 * set-state-in-effect` (setState synchronously in an effect body causes a
 * cascading render), and it also rendered one frame of `light` before
 * correcting itself, which flipped the theme toggle's icon on every load for
 * dark-mode users. `getServerSnapshot` returns the light default, so the
 * server HTML and the hydration render agree; React then reconciles against
 * `getSnapshot` (the real DOM class) immediately after hydrating.
 *
 * Light is still the default: absent a stored preference the init script
 * removes `.dark`, and `getSnapshot` reports `light`. OS `prefers-color-scheme`
 * is deliberately NOT consulted — this site opts into light and lets the
 * header toggle move it, which is the behaviour that shipped.
 */
const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

function emit() {
  for (const listener of listeners) listener();
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function getServerSnapshot(): Theme {
  return 'light';
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* Safari private mode / storage disabled — the class still applied. */
    }
    emit();
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(getSnapshot() === 'dark' ? 'light' : 'dark');
  }, [setTheme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

/** Inline script — prevent flash of wrong theme before hydration. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');if(t==='dark'){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}else{document.documentElement.classList.remove('dark');document.documentElement.style.colorScheme='light';}}catch(e){}})();`;
