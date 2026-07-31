'use client';

/**
 * Opt-in controls for new-mail alerts.
 *
 * Desktop notifications need a real user gesture to request permission, so the
 * toggle has to live in the UI rather than being flipped for people at load
 * time. Keeping it in the inbox header puts it where someone thinks "I wish
 * this told me" — the moment they want it.
 */

import { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@crm-eco/ui/components/popover';
import { Switch } from '@crm-eco/ui/components/switch';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  DEFAULT_NOTIFICATION_PREFS,
  readNotificationPrefs,
  writeNotificationPrefs,
  type NotificationPrefs,
} from '@/lib/inbox/notification-prefs';

export function NotificationSettings() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);

  // Read after mount: localStorage and Notification do not exist during SSR,
  // and reading them in useState would break hydration.
  useEffect(() => {
    setPrefs(readNotificationPrefs(window.localStorage));
    setPermission(typeof Notification === 'undefined' ? null : Notification.permission);
  }, []);

  const persist = useCallback((next: NotificationPrefs) => {
    setPrefs(next);
    writeNotificationPrefs(next, window.localStorage);
  }, []);

  const handleDesktopToggle = useCallback(
    async (enabled: boolean) => {
      if (!enabled) {
        persist({ ...prefs, desktop: false });
        return;
      }

      if (typeof Notification === 'undefined') {
        toast.error('This browser does not support desktop notifications');
        return;
      }

      // Asking again after a denial is a no-op in every browser — the user has
      // to clear it in site settings, so say that instead of failing silently.
      if (Notification.permission === 'denied') {
        setPermission('denied');
        toast.error('Desktop notifications are blocked', {
          description: 'Allow notifications for this site in your browser settings, then try again.',
        });
        return;
      }

      const result =
        Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      setPermission(result);

      if (result !== 'granted') {
        toast.error('Desktop notifications were not allowed');
        return;
      }

      persist({ ...prefs, desktop: true });
      toast.success('Desktop alerts on', {
        description: 'You will be notified of new email when this tab is in the background.',
      });
    },
    [persist, prefs],
  );

  const anyEnabled = prefs.desktop || prefs.sound;
  const blocked = permission === 'denied';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="New email alert settings"
          title="New email alert settings"
          className="relative p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          {anyEnabled ? (
            <Bell className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          ) : (
            <BellOff className="w-5 h-5 text-slate-500" />
          )}
          {blocked && (
            <span
              aria-hidden="true"
              className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500"
            />
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">New email alerts</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            In-app popups are always on. These settings apply to this device only.
          </p>
        </div>

        <div className="p-4 space-y-4">
          <label className="flex items-start justify-between gap-3 cursor-pointer">
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800 dark:text-slate-200">
                <Bell className="w-3.5 h-3.5" aria-hidden="true" />
                Desktop notifications
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {blocked
                  ? 'Blocked by your browser — allow notifications in site settings.'
                  : 'Shown when this tab is in the background.'}
              </span>
            </span>
            <Switch
              checked={prefs.desktop}
              onCheckedChange={handleDesktopToggle}
              disabled={blocked}
              aria-label="Desktop notifications"
            />
          </label>

          <label className="flex items-start justify-between gap-3 cursor-pointer">
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800 dark:text-slate-200">
                <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                Sound
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                A short chime when new mail arrives.
              </span>
            </span>
            <Switch
              checked={prefs.sound}
              onCheckedChange={(sound) => persist({ ...prefs, sound })}
              aria-label="Notification sound"
            />
          </label>
        </div>

        <div
          className={cn(
            'px-4 py-2.5 border-t border-slate-200 dark:border-slate-700',
            'text-xs text-slate-500 dark:text-slate-400',
          )}
        >
          Alerts cover every shared mailbox you can access.
        </div>
      </PopoverContent>
    </Popover>
  );
}
