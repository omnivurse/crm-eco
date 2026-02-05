'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase-client';
import { useClientAuth } from '@/hooks/useClientAuth';

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
  // Cache user ID to avoid repeated auth calls
  const [cachedUserId, setCachedUserId] = useState<string | null>(null);

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
    
    // Load from localStorage (fast). Only fall back to DB when localStorage is empty.
    // setTheme() writes to both localStorage and DB simultaneously, so they stay in sync.
    const storedTheme = localStorage.getItem(storageKey) as Theme | null;
    if (storedTheme && ['light', 'dark', 'system'].includes(storedTheme)) {
      setThemeState(storedTheme);
      applyTheme(storedTheme);
      setIsLoading(false);
    } else {
      // Default to light immediately
      applyTheme(defaultTheme);

      // No localStorage value — query DB as fallback (first visit / cleared cache)
      const loadFromDB = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            // Cache user ID for later use (avoids repeated getUser calls)
            setCachedUserId(user.id);
            
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
    }
  }, [storageKey, defaultTheme, applyTheme]);

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

    // Persist to DB using cached user ID if available (avoids extra auth call)
    try {
      const userId = cachedUserId || (await supabase.auth.getUser()).data.user?.id;
      if (userId) {
        if (!cachedUserId) setCachedUserId(userId);
        await supabase
          .from('profiles')
          .update({ ui_theme: newTheme })
          .eq('user_id', userId);
      }
    } catch (error) {
      console.warn('Failed to save theme to DB:', error);
    }
  }, [storageKey, applyTheme, cachedUserId]);

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
