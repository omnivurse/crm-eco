'use client';

import { createContext, useContext } from 'react';
import type { Density } from './ViewPreferencesContext';

interface ModuleShellContextValue {
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  visibleColumns: string[];
  setVisibleColumns: (columns: string[]) => void;
  density: Density;
  sortField: string | null;
  sortDirection: 'asc' | 'desc';
  moduleKey: string;
}

const ModuleShellContext = createContext<ModuleShellContextValue | null>(null);

export function ModuleShellProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: ModuleShellContextValue;
}) {
  return (
    <ModuleShellContext.Provider value={value}>
      {children}
    </ModuleShellContext.Provider>
  );
}

export function useModuleShell() {
  const context = useContext(ModuleShellContext);
  if (!context) {
    throw new Error('useModuleShell must be used within a ModuleShellProvider');
  }
  return context;
}

export function useModuleShellOptional() {
  return useContext(ModuleShellContext);
}
