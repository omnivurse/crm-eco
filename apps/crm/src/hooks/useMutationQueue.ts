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
  // `retry` forwards the options bag so callers (notably the conflict
  // review dialog) can opt into `{ force: true }` which drops the
  // If-Match precondition before the replay.
  const retry = useCallback(
    (id: string, options?: { force?: boolean }) =>
      mutationQueue.retry(id, options),
    [],
  );
  const clearFailed = useCallback(() => mutationQueue.clearFailed(), []);
  const clearAll = useCallback(() => mutationQueue.clearAll(), []);

  return useMemo(
    () => ({ ...snapshot, flush, remove, retry, clearFailed, clearAll }),
    [snapshot, flush, remove, retry, clearFailed, clearAll],
  );
}
