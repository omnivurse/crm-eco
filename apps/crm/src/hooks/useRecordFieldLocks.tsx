'use client';

/**
 * useRecordFieldLocks — thin context wrapper around `useRecordPresence`'s
 * per-field lock state so inline editors deep in the tree can check
 * ownership without threading props through every cell.
 *
 * Values passed to the provider are intentionally the hook's outputs —
 * the parent owns the presence lifecycle; this is just a descendant
 * read path + action passthrough.
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { RecordPresenceEntry } from './useRecordPresence';

export interface RecordFieldLocksContextValue {
  /** Field key -> *other* participant holding the lock. Empty = free. */
  fieldLocks: Record<string, RecordPresenceEntry>;
  /** Claim a lock for the current user. Safe to call repeatedly. */
  acquireFieldLock: (field: string) => Promise<void>;
  /** Release a lock for the current user. Safe to call repeatedly. */
  releaseFieldLock: (field: string) => Promise<void>;
}

const Ctx = createContext<RecordFieldLocksContextValue | null>(null);

export interface RecordFieldLocksProviderProps extends RecordFieldLocksContextValue {
  children: ReactNode;
}

export function RecordFieldLocksProvider({
  fieldLocks,
  acquireFieldLock,
  releaseFieldLock,
  children,
}: RecordFieldLocksProviderProps) {
  return (
    <Ctx.Provider value={{ fieldLocks, acquireFieldLock, releaseFieldLock }}>
      {children}
    </Ctx.Provider>
  );
}

/**
 * Returns the lock context, or a no-op fallback when the tree isn't
 * wrapped. Inline editors call this every render so we keep the fallback
 * stable (same object identity) to avoid unnecessary re-renders.
 */
const NOOP_CONTEXT: RecordFieldLocksContextValue = {
  fieldLocks: {},
  acquireFieldLock: async () => {},
  releaseFieldLock: async () => {},
};

export function useRecordFieldLocks(): RecordFieldLocksContextValue {
  return useContext(Ctx) ?? NOOP_CONTEXT;
}

/**
 * Convenience: get the lock owner for a single field (or null).
 */
export function useFieldLockOwner(field: string): RecordPresenceEntry | null {
  const { fieldLocks } = useRecordFieldLocks();
  return fieldLocks[field] ?? null;
}
