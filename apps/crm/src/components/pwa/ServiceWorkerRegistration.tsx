'use client';

import { useEffect, useState, useCallback } from 'react';

/**
 * ServiceWorkerRegistration Component
 * Registers the service worker and handles PWA updates
 */
export function ServiceWorkerRegistration() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    // Only register in production builds. Next.js dev server + HMR produces
    // transient fetch failures that the SW otherwise logs and caches stale
    // chunks. Opt back in locally with NEXT_PUBLIC_ENABLE_SW=true.
    const isProd = process.env.NODE_ENV === 'production';
    const forceEnable = process.env.NEXT_PUBLIC_ENABLE_SW === 'true';
    const forceDisable = process.env.NEXT_PUBLIC_ENABLE_SW === 'false';
    const swEnabled = !forceDisable && (isProd || forceEnable);

    if (swEnabled && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      registerServiceWorker();

      // Listen for update events
      window.addEventListener('sw-update-available', () => {
        setUpdateAvailable(true);
      });

      // Recover from a stale SW that's serving mismatched chunks after a deploy.
      // Detect the runtime error, unregister all SWs, drop all caches, then reload
      // once. The reload guard prevents a loop if the error has another cause.
      const RECOVERY_KEY = '__crm_sw_chunk_recovery__';
      const shouldRecoverFromStaleDeploy = (message: string) =>
        message.includes("undefined (reading 'call')") ||
        message.includes('ChunkLoadError') ||
        /Loading CSS chunk .* failed/i.test(message) ||
        /Failed to fetch dynamically imported module/i.test(message) ||
        (message.includes('net::ERR_ABORTED') && message.includes('/_next/static/'));

      const handleChunkError = (message: string) => {
        if (!shouldRecoverFromStaleDeploy(message)) return;
        if (sessionStorage.getItem(RECOVERY_KEY)) return;
        sessionStorage.setItem(RECOVERY_KEY, '1');
        Promise.all([
          navigator.serviceWorker.getRegistrations().then((regs) => Promise.all(regs.map((r) => r.unregister()))),
          'caches' in window ? caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))) : Promise.resolve(),
        ]).finally(() => window.location.reload());
      };
      window.addEventListener('error', (e) => handleChunkError(e.message || String(e.error?.message || '')));
      window.addEventListener('unhandledrejection', (e) => handleChunkError(String(e.reason?.message || e.reason || '')));

      const watchStylesheetFailures = () => {
        const onStylesheetError = (link: HTMLLinkElement) => {
          if (link.href.includes('/_next/static/')) {
            handleChunkError(`Loading CSS chunk failed: ${link.href}`);
          }
        };

        document.querySelectorAll('link[rel="stylesheet"]').forEach((node) => {
          node.addEventListener('error', () => onStylesheetError(node as HTMLLinkElement));
        });

        const observer = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            mutation.addedNodes.forEach((node) => {
              if (node instanceof HTMLLinkElement && node.rel === 'stylesheet') {
                node.addEventListener('error', () => onStylesheetError(node));
              }
            });
          }
        });
        observer.observe(document.head, { childList: true });
      };
      watchStylesheetFailures();

      // When a new SW activates after deploy, reload once so clients pick up fresh chunks.
      const RELOAD_KEY = '__crm_sw_controller_reload__';
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (sessionStorage.getItem(RELOAD_KEY)) return;
        sessionStorage.setItem(RELOAD_KEY, '1');
        window.location.reload();
      });
    } else if (!swEnabled && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // If a previous build registered a SW, unregister it in dev so stale
      // caches don't interfere with HMR.
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => {
          if (reg.active?.scriptURL.endsWith('/sw.js')) {
            reg.unregister();
          }
        });
      });
    }
  }, []);

  const handleUpdate = useCallback(() => {
    // Reload to get the new version
    window.location.reload();
  }, []);

  // Show update banner when new version is available
  if (updateAvailable) {
    return (
      <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-4">
        <div className="bg-slate-900 dark:bg-slate-800 text-white rounded-lg shadow-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg 
                className="w-5 h-5 text-blue-400" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Update Available</p>
              <p className="text-xs text-slate-300 mt-1">
                A new version is ready. Refresh to update.
              </p>
            </div>
            <button
              onClick={handleUpdate}
              className="flex-shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium px-3 py-1.5 rounded transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

/**
 * Register the service worker
 */
async function registerServiceWorker() {
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    console.log('[PWA] Service worker registered:', registration.scope);

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[PWA] New version available');
            window.dispatchEvent(new CustomEvent('sw-update-available'));
          }
        });
      }
    });

    // Check for updates every hour
    setInterval(() => {
      registration.update();
    }, 60 * 60 * 1000);

    // Check for updates on visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        registration.update();
      }
    });

  } catch (error) {
    console.error('[PWA] Service worker registration failed:', error);
  }
}

/**
 * Hook to check if app is installed as PWA
 */
export function useIsPWA(): boolean {
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    // Check if running in standalone mode (installed PWA)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = (window.navigator as any).standalone === true;
    queueMicrotask(() => setIsPWA(isStandalone || isIOSStandalone));
  }, []);

  return isPWA;
}

/**
 * Hook to prompt PWA installation
 */
export function usePWAInstall() {
  const [canInstall, setCanInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    setDeferredPrompt(null);
    setCanInstall(false);
    
    return outcome === 'accepted';
  }, [deferredPrompt]);

  return { canInstall, install };
}
