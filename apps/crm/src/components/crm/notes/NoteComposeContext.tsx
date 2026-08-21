'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface NoteComposeContextValue {
  /** Increments each time a caller asks to open the in-pane composer. */
  composeNonce: number;
  requestCompose: () => void;
}

const NoteComposeContext = createContext<NoteComposeContextValue | null>(null);

export function NoteComposeProvider({
  children,
  composeNonce: controlledNonce,
  requestCompose: controlledRequest,
}: {
  children: ReactNode;
  composeNonce?: number;
  requestCompose?: () => void;
}) {
  const [internalNonce, setInternalNonce] = useState(0);
  const requestCompose = useCallback(() => {
    if (controlledRequest) controlledRequest();
    else setInternalNonce((n) => n + 1);
  }, [controlledRequest]);
  const composeNonce = controlledNonce ?? internalNonce;
  const value = useMemo(
    () => ({ composeNonce, requestCompose }),
    [composeNonce, requestCompose],
  );
  return <NoteComposeContext.Provider value={value}>{children}</NoteComposeContext.Provider>;
}

export function useNoteCompose(): NoteComposeContextValue | null {
  return useContext(NoteComposeContext);
}

export function useNoteComposeRequired(): NoteComposeContextValue {
  const ctx = useContext(NoteComposeContext);
  if (!ctx) {
    throw new Error('useNoteComposeRequired must be used inside NoteComposeProvider');
  }
  return ctx;
}
