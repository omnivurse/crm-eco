'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

const DISMISS_KEY = 'dhh.pwa.install.dismissed_at';
const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

/**
 * PWA install prompt — non-intrusive bottom sheet on mobile.
 * Listens for beforeinstallprompt, throttled to once per 30 days when dismissed.
 */
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const lastDismiss = Number(localStorage.getItem(DISMISS_KEY) ?? '0');
    if (lastDismiss && Date.now() - lastDismiss < DISMISS_TTL_MS) {
      return;
    }

    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  }

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'dismissed') {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
    setDeferredPrompt(null);
    setVisible(false);
  }

  if (!visible || !deferredPrompt) return null;

  return (
    <div
      className="fixed left-3 right-3 bottom-3 z-50 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl md:left-auto md:right-6 md:bottom-6 md:max-w-sm"
      role="dialog"
      aria-label="Install app"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
          <Download className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">Install Member Portal</p>
          <p className="mt-0.5 text-sm text-slate-600">
            Add to your home screen for fast access and offline support.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={install}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Install
            </button>
            <button
              onClick={dismiss}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="-mr-1 -mt-1 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
