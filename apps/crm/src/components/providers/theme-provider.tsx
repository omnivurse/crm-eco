'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import {
  THEME_STORAGE_KEY,
  isTheme,
  readStoredTheme,
  type Theme,
} from '@crm-eco/ui/lib/theme-boot';
import { supabase } from '@/lib/supabase-client';
import { useClientAuth } from '@/hooks/useClientAuth';

interface ThemeProviderContextValue {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  isLoading: boolean;
}

const ThemeProviderContext = createContext<ThemeProviderContextValue | undefined>(undefined);

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
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Resolve system theme
  const getSystemTheme = useCallback((): 'light' | 'dark' => {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }, []);

  // Apply theme to document - only update if different to avoid flash
  const applyTheme = useCallback((newTheme: Theme) => {
    const root = window.document.documentElement;
    const resolved = newTheme === 'system' ? getSystemTheme() : newTheme;

    // Only update DOM if the class is different (prevents flash on initial load)
    const currentTheme = root.classList.contains('dark') ? 'dark' : 'light';
    if (currentTheme !== resolved) {
      root.classList.remove('light', 'dark');
      root.classList.add(resolved);
    }
    queueMicrotask(() => setResolvedTheme(resolved));
  }, [getSystemTheme]);

  // Load theme from localStorage first (fast), then from authProfile (authoritative).
  // readStoredTheme() migrates a legacy `crm-theme` value into the shared key,
  // so an existing choice survives the switch. A caller that overrides
  // storageKey opts out of that migration and reads its own key directly.
  useEffect(() => {
    const storedTheme =
      storageKey === THEME_STORAGE_KEY
        ? readStoredTheme()
        : (localStorage.getItem(storageKey) as Theme | null);
    if (isTheme(storedTheme)) {
      applyTheme(storedTheme);
      queueMicrotask(() => {
        setMounted(true);
        setThemeState(storedTheme);
        setIsLoading(false);
      });
    } else {
      // Default to light immediately
      applyTheme(defaultTheme);
      queueMicrotask(() => {
        setMounted(true);
        setIsLoading(false);
      });
    }
  }, [storageKey, defaultTheme, applyTheme]);

  // Sync theme from profile if no localStorage value exists
  useEffect(() => {
    if (!mounted) return;
    const storedTheme = localStorage.getItem(storageKey);
    if (!storedTheme && authProfile) {
      // Fetch ui_theme from profile (authProfile doesn't include ui_theme, so query it)
      const loadThemeFromProfile = async () => {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('ui_theme')
            .eq('user_id', authProfile.user_id)
            .single();

          if (profile?.ui_theme && ['light', 'dark', 'system'].includes(profile.ui_theme)) {
            setThemeState(profile.ui_theme as Theme);
            applyTheme(profile.ui_theme as Theme);
            localStorage.setItem(storageKey, profile.ui_theme);
          }
        } catch (error) {
          console.warn('Failed to load theme from profile:', error);
        }
      };
      loadThemeFromProfile();
    }
  }, [mounted, authProfile, storageKey, applyTheme]);

  // Listen for system theme changes
  useEffect(() => {
    if (!mounted) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, mounted, applyTheme]);

  // Set theme and persist to localStorage + DB
  const setTheme = useCallback(async (newTheme: Theme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
    localStorage.setItem(storageKey, newTheme);

    // Persist to DB using authProfile user_id (avoids extra auth call)
    try {
      const userId = authProfile?.user_id || authUser?.id;
      if (userId) {
        await supabase
          .from('profiles')
          .update({ ui_theme: newTheme })
          .eq('user_id', userId);
      }
    } catch (error) {
      console.warn('Failed to save theme to DB:', error);
    }
  }, [storageKey, applyTheme, authProfile, authUser]);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, isLoading: isLoading || !mounted }),
    [theme, resolvedTheme, setTheme, isLoading, mounted]
  );

  // Always render children - the script in layout.tsx handles initial theme class
  // This prevents blank page flash while still avoiding hydration mismatch
  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
