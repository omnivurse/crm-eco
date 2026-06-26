'use client';

import { useEffect, useState, useCallback } from 'react';

/**
 * ServiceWorkerRegistration — deploy-safe PWA registration for the member portal.
 */
export function ServiceWorkerRegistration() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const isProd = process.env.NODE_ENV === 'production';
    const forceEnable = process.env.NEXT_PUBLIC_ENABLE_SW === 'true';
    const forceDisable = process.env.NEXT_PUBLIC_ENABLE_SW === 'false';
    const swEnabled = !forceDisable && (isProd || forceEnable);

    if (swEnabled && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      registerServiceWorker();

      window.addEventListener('sw-update-available', () => {
        setUpdateAvailable(true);
      });

      const RECOVERY_KEY = '__portal_sw_chunk_recovery__';
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

      const RELOAD_KEY = '__portal_sw_controller_reload__';
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (sessionStorage.getItem(RELOAD_KEY)) return;
        sessionStorage.setItem(RELOAD_KEY, '1');
        window.location.reload();
      });
    } else if (!swEnabled && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
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
    window.location.reload();
  }, []);

  if (updateAvailable) {
    return (
      <div className="fixed bottom-4 right-4 z-50 max-w-sm">
        <div className="bg-slate-900 text-white rounded-lg shadow-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium">Update Available</p>
              <p className="text-xs text-slate-300 mt-1">A new version is ready. Refresh to update.</p>
            </div>
            <button
              onClick={handleUpdate}
              className="flex-shrink-0 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium px-3 py-1.5 rounded transition-colors"
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

async function registerServiceWorker() {
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            window.dispatchEvent(new CustomEvent('sw-update-available'));
          }
        });
      }
    });

    setInterval(() => {
      registration.update();
    }, 60 * 60 * 1000);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        registration.update();
      }
    });
  } catch (error) {
    console.error('[Portal PWA] Service worker registration failed:', error);
  }
}
