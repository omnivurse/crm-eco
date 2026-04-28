'use client';

/**
 * Top-bar control: simulate offline mode (queues writes, cached reads only)
 * without disconnecting the device. Persists in localStorage per browser.
 */

import { memo, useCallback, useEffect, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  FORCE_OFFLINE_CHANGED_EVENT,
  getForceOffline,
  setForceOffline,
} from '@/lib/offline/force-offline';

export const ConnectivityModeToggle = memo(function ConnectivityModeToggle({
  className,
}: {
  className?: string;
}) {
  const [forceOffline, setForced] = useState(false);
  const [navOnline, setNavOnline] = useState(true);

  useEffect(() => {
    setForced(getForceOffline());
    setNavOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const onStorage = () => setForced(getForceOffline());
    const onForceEvent = () => setForced(getForceOffline());
    const onOnline = () => setNavOnline(true);
    const onOffline = () => setNavOnline(false);
    window.addEventListener(FORCE_OFFLINE_CHANGED_EVENT, onForceEvent);
    window.addEventListener('storage', onStorage);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener(FORCE_OFFLINE_CHANGED_EVENT, onForceEvent);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const effectiveOnline = navOnline && !forceOffline;

  const toggle = useCallback(() => {
    if (!navOnline && !forceOffline) return;
    setForceOffline(!getForceOffline());
  }, [navOnline, forceOffline]);

  const disabled = !navOnline && !forceOffline;

  const title = disabled
    ? 'Device is offline — reconnect to use the CRM'
    : forceOffline
      ? 'Simulated offline is on — click to use live connection again'
      : 'Simulate offline (queue edits; use cached reads). Does not turn off Wi‑Fi.';

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={disabled}
      onClick={toggle}
      aria-pressed={forceOffline}
      title={title}
      className={cn(
        'h-8 w-8 rounded-md transition-colors',
        forceOffline
          ? 'text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 dark:text-amber-300 dark:bg-amber-500/15 dark:border-amber-500/40 dark:hover:bg-amber-500/25'
          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10',
        className,
      )}
    >
      {effectiveOnline ? (
        <Wifi className="w-4 h-4" aria-hidden />
      ) : (
        <WifiOff className="w-4 h-4" aria-hidden />
      )}
      <span className="sr-only">
        {forceOffline ? 'Simulated offline on' : 'Simulated offline off'}
      </span>
    </Button>
  );
});
