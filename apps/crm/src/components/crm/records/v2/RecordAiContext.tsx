'use client';

/**
 * Lightweight context so inline editors (and future panels) can discover
 * the current record id + whether AI features should render, without
 * threading props through every level. The shell mounts this once; if
 * it's absent the editors transparently skip their AI affordances.
 */

import { createContext, useContext, type ReactNode } from 'react';

export interface RecordAiContextValue {
  recordId: string;
  /** Master switch (e.g. off for anonymous / restricted users). */
  enabled: boolean;
}

const Ctx = createContext<RecordAiContextValue | null>(null);

export interface RecordAiContextProviderProps extends RecordAiContextValue {
  children: ReactNode;
}

export function RecordAiContextProvider({
  recordId,
  enabled,
  children,
}: RecordAiContextProviderProps) {
  return <Ctx.Provider value={{ recordId, enabled }}>{children}</Ctx.Provider>;
}

export function useRecordAiContext(): RecordAiContextValue | null {
  return useContext(Ctx);
}
