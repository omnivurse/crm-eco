'use client';

/**
 * OfflineBanner — a slim, stuck-to-top banner that appears whenever the
 * browser reports `navigator.onLine === false`. Reassures the user that
 * typed changes are still being captured (via the mutation queue) and
 * will replay automatically on reconnection.
 *
 * Intentionally independent of the topbar pill — the pill only appears
 * when there's queued work, whereas this banner fires on connectivity
 * loss even before the first failed request.
 */

import { memo, useEffect, useRef, useState } from 'react';
import { WifiOff, Database } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import { useMutationQueue } from '@/hooks/useMutationQueue';
import { subscribeCacheServed } from '@/lib/offline/cached-fetch';
import {
  FORCE_OFFLINE_CHANGED_EVENT,
  getForceOffline,
} from '@/lib/offline/force-offline';

export const OfflineBanner = memo(function OfflineBanner({
  className,
}: {
  className?: string;
}) {
  const { isOnline, pending } = useMutationQueue();
  const [simulated, setSimulated] = useState(false);
  useEffect(() => {
    const sync = () => {
      if (typeof navigator === 'undefined') return;
      setSimulated(getForceOffline() && navigator.onLine);
    };
    sync();
    window.addEventListener(FORCE_OFFLINE_CHANGED_EVENT, sync);
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener(FORCE_OFFLINE_CHANGED_EVENT, sync);
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  // Track cache reads that happened *while offline* — powers the
  // "Showing cached data" suffix. We only increment the counter when
  // `isOnline === false` at the moment the event fires, which lets us
  // drop the effect that reset the counter on reconnection (which
  // would have tripped the `set-state-in-effect` lint).
  const isOnlineRef = useRef(isOnline);
  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  const [cachedReads, setCachedReads] = useState(0);
  useEffect(() => {
    return subscribeCacheServed(({ fromCache }) => {
      if (!fromCache) return;
      if (isOnlineRef.current) return;
      setCachedReads((n) => n + 1);
    });
  }, []);

  // Reset when we regain connectivity without calling setState
  // from an effect — derive the display count from the live signal.
  const displayCachedReads = isOnline ? 0 : cachedReads;

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-1.5 text-xs font-medium',
        'bg-amber-50 text-amber-900 border-b border-amber-200',
        'dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/20',
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        <WifiOff className="w-3.5 h-3.5" />
        You&apos;re offline — changes are saved locally
        {simulated ? ' (simulated)' : ''}
        {pending.length > 0
          ? ` (${pending.length} queued)`
          : ''}{' '}
        and will sync automatically when you&apos;re back online.
      </span>
      {displayCachedReads > 0 ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-200/60 dark:bg-amber-500/20 px-2 py-0.5 text-[11px]">
          <Database className="w-3 h-3" />
          Showing cached data
        </span>
      ) : null}
    </div>
  );
});
