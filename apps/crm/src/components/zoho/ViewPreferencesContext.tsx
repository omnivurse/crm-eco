'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export type Density = 'compact' | 'default' | 'comfortable';

export interface ViewPreferences {
  viewId: string | null;
  columns: string[];
  density: Density;
  sortField: string | null;
  sortDirection: 'asc' | 'desc';
}

interface ViewPreferencesContextValue {
  preferences: Record<string, ViewPreferences>;
  getPreferences: (moduleKey: string) => ViewPreferences;
  setViewId: (moduleKey: string, viewId: string | null) => void;
  setColumns: (moduleKey: string, columns: string[]) => void;
  setDensity: (moduleKey: string, density: Density) => void;
  setSort: (moduleKey: string, field: string | null, direction: 'asc' | 'desc') => void;
  savePreferences: (moduleKey: string) => Promise<void>;
}

const defaultPreferences: ViewPreferences = {
  viewId: null,
  columns: ['title', 'status', 'email', 'created_at'],
  density: 'default',
  sortField: null,
  sortDirection: 'asc',
};

const ViewPreferencesContext = createContext<ViewPreferencesContextValue | undefined>(undefined);

const STORAGE_KEY = 'crm_view_preferences';

interface ViewPreferencesProviderProps {
  children: ReactNode;
}

export function ViewPreferencesProvider({ children }: ViewPreferencesProviderProps) {
  const [preferences, setPreferences] = useState<Record<string, ViewPreferences>>({});
  const [loaded, setLoaded] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Load preferences from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setPreferences(JSON.parse(stored));
      } catch {
        console.warn('Failed to parse stored view preferences');
      }
    }
    setLoaded(true);
  }, []);

  // Save to localStorage whenever preferences change
  useEffect(() => {
    if (loaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    }
  }, [preferences, loaded]);

  const getPreferences = useCallback((moduleKey: string): ViewPreferences => {
    return preferences[moduleKey] || { ...defaultPreferences };
  }, [preferences]);

  const updatePreferences = useCallback((moduleKey: string, updates: Partial<ViewPreferences>) => {
    setPreferences(prev => ({
      ...prev,
      [moduleKey]: {
        ...defaultPreferences,
        ...prev[moduleKey],
        ...updates,
      },
    }));
  }, []);

  const setViewId = useCallback((moduleKey: string, viewId: string | null) => {
    updatePreferences(moduleKey, { viewId });
  }, [updatePreferences]);

  const setColumns = useCallback((moduleKey: string, columns: string[]) => {
    updatePreferences(moduleKey, { columns });
  }, [updatePreferences]);

  const setDensity = useCallback((moduleKey: string, density: Density) => {
    updatePreferences(moduleKey, { density });
  }, [updatePreferences]);

  const setSort = useCallback((moduleKey: string, field: string | null, direction: 'asc' | 'desc') => {
    updatePreferences(moduleKey, { sortField: field, sortDirection: direction });
  }, [updatePreferences]);

  // TODO: When crm_saved_views table exists, persist to DB
  const savePreferences = useCallback(async (moduleKey: string) => {
    // For now, preferences are auto-saved to localStorage
    // When DB table is ready, save there as well
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Future: await supabase.from('crm_user_preferences').upsert(...)
        console.log('View preferences saved for', moduleKey);
      }
    } catch (error) {
      console.warn('Failed to save preferences to DB:', error);
    }
  }, [supabase]);

  return (
    <ViewPreferencesContext.Provider
      value={{
        preferences,
        getPreferences,
        setViewId,
        setColumns,
        setDensity,
        setSort,
        savePreferences,
      }}
    >
      {children}
    </ViewPreferencesContext.Provider>
  );
}

export function useViewPreferences() {
  const context = useContext(ViewPreferencesContext);
  if (!context) {
    throw new Error('useViewPreferences must be used within ViewPreferencesProvider');
  }
  return context;
}
