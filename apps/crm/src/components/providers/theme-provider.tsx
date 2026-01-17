'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';

type Theme = 'light' | 'dark' | 'system';

interface ThemeProviderContextValue {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  isLoading: boolean;
}

const ThemeProviderContext = createContext<ThemeProviderContextValue | undefined>(undefined);

const STORAGE_KEY = 'crm-theme';

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
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Create Supabase client for DB persistence
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

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
    setResolvedTheme(resolved);
  }, [getSystemTheme]);

  // Load theme from localStorage first (fast), then DB (authoritative)
  useEffect(() => {
    setMounted(true);
    
    // Step 1: Load from localStorage for instant theme (no flash)
    const storedTheme = localStorage.getItem(storageKey) as Theme | null;
    if (storedTheme && ['light', 'dark', 'system'].includes(storedTheme)) {
      setThemeState(storedTheme);
      applyTheme(storedTheme);
    } else {
      // Default to light
      applyTheme(defaultTheme);
    }

    // Step 2: Load from DB (authoritative source)
    const loadFromDB = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('ui_theme')
            .eq('user_id', user.id)
            .single();

          if (profile?.ui_theme && ['light', 'dark', 'system'].includes(profile.ui_theme)) {
            setThemeState(profile.ui_theme as Theme);
            applyTheme(profile.ui_theme as Theme);
            localStorage.setItem(storageKey, profile.ui_theme);
          }
        }
      } catch (error) {
        console.warn('Failed to load theme from DB:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFromDB();
  }, [supabase, storageKey, defaultTheme, applyTheme]);

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

    // Persist to DB
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .update({ ui_theme: newTheme })
          .eq('user_id', user.id);
      }
    } catch (error) {
      console.warn('Failed to save theme to DB:', error);
    }
  }, [supabase, storageKey, applyTheme]);

  // Always render children - the script in layout.tsx handles initial theme class
  // This prevents blank page flash while still avoiding hydration mismatch
  return (
    <ThemeProviderContext.Provider value={{ theme, resolvedTheme, setTheme, isLoading: isLoading || !mounted }}>
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
