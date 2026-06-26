'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

/**
 * Service-worker update toast — listens for the `sw-update-available` custom
 * event dispatched by ServiceWorkerRegistration and prompts the user to refresh.
 */
export function UpdateToast() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function show() {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 10_000);
      return () => clearTimeout(t);
    }
    window.addEventListener('sw-update-available', show);
    return () => window.removeEventListener('sw-update-available', show);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed left-1/2 top-3 z-50 -translate-x-1/2 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-md"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <RefreshCw className="h-4 w-4 text-slate-700" />
        <span className="text-sm text-slate-800">New version available</span>
        <button
          onClick={() => location.reload()}
          className="ml-2 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800"
        >
          Refresh
        </button>
        <button
          onClick={() => setVisible(false)}
          aria-label="Dismiss"
          className="ml-1 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
