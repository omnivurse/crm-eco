'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

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

  // Load preferences from API and localStorage on mount
  useEffect(() => {
    async function loadPreferences() {
      // First, load from localStorage as fallback
      const stored = localStorage.getItem(STORAGE_KEY);
      let localPrefs: Record<string, ViewPreferences> = {};
      if (stored) {
        try {
          localPrefs = JSON.parse(stored);
        } catch {
          console.warn('Failed to parse stored view preferences');
        }
      }

      // Then try to load from API (DB takes precedence)
      try {
        const response = await fetch('/api/crm/preferences');
        if (response.ok) {
          const dbPrefs = await response.json();
          // Merge: DB prefs override local prefs
          setPreferences({ ...localPrefs, ...dbPrefs });
        } else {
          setPreferences(localPrefs);
        }
      } catch {
        // API not available, use local prefs
        setPreferences(localPrefs);
      }

      setLoaded(true);
    }

    loadPreferences();
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

  // Save preferences to API (DB) and localStorage
  const savePreferences = useCallback(async (moduleKey: string) => {
    const prefs = preferences[moduleKey];
    if (!prefs) return;

    try {
      const response = await fetch('/api/crm/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module_key: moduleKey,
          preferences: prefs,
        }),
      });

      if (!response.ok) {
        console.warn('Failed to save preferences to DB');
      }
    } catch (error) {
      console.warn('Failed to save preferences to DB:', error);
    }
  }, [preferences]);

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
