'use client';

import { createContext, useContext } from 'react';
import type { Density } from './ViewPreferencesContext';
import type { ViewMode } from '@/lib/crm/types';

interface ModuleShellContextValue {
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  visibleColumns: string[];
  setVisibleColumns: (columns: string[]) => void;
  density: Density;
  sortField: string | null;
  sortDirection: 'asc' | 'desc';
  handleSortChange: (field: string, direction: 'asc' | 'desc') => void;
  moduleKey: string;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  /**
   * Open the delete-confirmation dialog for the given record IDs. This is the
   * single entry point row-level views use so per-row Delete reuses the same
   * working bulk-delete flow (DELETE /api/crm/records/bulk).
   */
  requestDelete: (ids: string[]) => void;
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
