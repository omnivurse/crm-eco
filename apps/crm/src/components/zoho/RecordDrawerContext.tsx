'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface RecordDrawerContextValue {
  isOpen: boolean;
  recordId: string | null;
  moduleKey: string | null;
  openDrawer: (recordId: string, moduleKey: string) => void;
  closeDrawer: () => void;
}

const RecordDrawerContext = createContext<RecordDrawerContextValue | undefined>(undefined);

interface RecordDrawerProviderProps {
  children: ReactNode;
}

export function RecordDrawerProvider({ children }: RecordDrawerProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [moduleKey, setModuleKey] = useState<string | null>(null);

  const openDrawer = useCallback((id: string, module: string) => {
    setRecordId(id);
    setModuleKey(module);
    setIsOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsOpen(false);
    // Delay clearing the data to allow exit animation
    setTimeout(() => {
      setRecordId(null);
      setModuleKey(null);
    }, 300);
  }, []);

  return (
    <RecordDrawerContext.Provider
      value={{
        isOpen,
        recordId,
        moduleKey,
        openDrawer,
        closeDrawer,
      }}
    >
      {children}
    </RecordDrawerContext.Provider>
  );
}

export function useRecordDrawer() {
  const context = useContext(RecordDrawerContext);
  if (!context) {
    throw new Error('useRecordDrawer must be used within RecordDrawerProvider');
  }
  return context;
}
