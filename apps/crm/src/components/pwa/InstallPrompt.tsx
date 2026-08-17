'use client';

import { useState, useEffect } from 'react';
import { usePWAInstall, useIsPWA } from './ServiceWorkerRegistration';
import { X, Download, Smartphone } from 'lucide-react';

/**
 * InstallPrompt Component
 * Shows a prompt to install the PWA when available
 * Dismissable and remembers user preference
 */
export function InstallPrompt() {
  const { canInstall, install } = usePWAInstall();
  const isPWA = useIsPWA();
  const [dismissed, setDismissed] = useState(true);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if user previously dismissed
    const wasDismissed = localStorage.getItem('pwa-install-dismissed');
    const dismissedAt = wasDismissed ? parseInt(wasDismissed, 10) : 0;
    const daysSinceDismiss = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);

    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

    queueMicrotask(() => {
      // Show again after 7 days
      if (daysSinceDismiss > 7) {
        setDismissed(false);
      }
      setIsIOS(isIOSDevice);
    });
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  const handleInstall = async () => {
    const installed = await install();
    if (installed) {
      setDismissed(true);
    }
  };

  // Don't show if already installed as PWA
  if (isPWA) return null;
  
  // Don't show if dismissed
  if (dismissed) return null;

  // Don't show if can't install (unless iOS)
  if (!canInstall && !isIOS) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 animate-in slide-in-from-bottom-4 fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                Install App
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Get quick access
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
            Install Double Helix Hub on your device for faster access, offline support, and a native app experience.
          </p>

          {isIOS ? (
            // iOS installation instructions
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 mb-4">
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                To install on iOS:
              </p>
              <ol className="text-xs text-slate-600 dark:text-slate-400 space-y-1 list-decimal list-inside">
                <li>Tap the <strong>Share</strong> button in Safari</li>
                <li>Scroll down and tap <strong>Add to Home Screen</strong></li>
                <li>Tap <strong>Add</strong> to confirm</li>
              </ol>
            </div>
          ) : (
            // Native install button
            <button
              onClick={handleInstall}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2.5 px-4 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Install Now
            </button>
          )}

          <p className="text-xs text-slate-400 dark:text-slate-500 mt-3 text-center">
            No app store needed • Works offline
          </p>
        </div>
      </div>
    </div>
  );
}
