'use client';

/**
 * useMutationQueue — React binding for the module-level `mutationQueue`.
 *
 * The hook subscribes to the singleton and re-renders when the snapshot
 * changes (new enqueue, retry, success, failure, online/offline flip).
 * Components get a small, memoised handle: current snapshot + action
 * callbacks.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  mutationQueue,
  type QueueSnapshot,
} from '@/lib/offline/mutation-queue';

export function useMutationQueue() {
  const [snapshot, setSnapshot] = useState<QueueSnapshot>(() =>
    mutationQueue.snapshot(),
  );

  useEffect(() => {
    return mutationQueue.subscribe(setSnapshot);
  }, []);

  const flush = useCallback(() => mutationQueue.flush(), []);
  const remove = useCallback((id: string) => mutationQueue.remove(id), []);
  const retry = useCallback((id: string) => mutationQueue.retry(id), []);
  const clearFailed = useCallback(() => mutationQueue.clearFailed(), []);

  return useMemo(
    () => ({ ...snapshot, flush, remove, retry, clearFailed }),
    [snapshot, flush, remove, retry, clearFailed],
  );
}
