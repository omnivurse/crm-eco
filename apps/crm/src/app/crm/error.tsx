'use client';

/**
 * CRM Error Handler
 * Catches errors specifically in the /crm route tree.
 *
 * Improvements:
 * - "Try again" now attempts a Supabase session refresh before calling
 *   reset(), giving the re-render a real chance of succeeding.
 * - "Go to Login" uses a hard page navigation (window.location) instead of
 *   an SPA link so middleware re-runs the full auth check and doesn't
 *   short-circuit back to the dashboard.
 */

import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

export default function CrmError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    // Log error for debugging
    console.error('CRM route error:', {
      message: error.message,
      digest: error.digest,
      name: error.name,
    });
  }, [error]);

  const handleTryAgain = async () => {
    setRetrying(true);
    try {
      // Attempt to refresh the Supabase session before re-rendering.
      // If the JWT expired while the user was away, this gives the
      // server-side render a valid token to work with.
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        await supabase.auth.refreshSession();
      }
    } catch (err) {
      console.warn('[CrmError] Session refresh failed:', err);
    }
    // Always call reset — the refresh may or may not have helped,
    // but the user asked to try again.
    reset();
    setRetrying(false);
  };

  const handleGoToLogin = () => {
    // Hard navigation bypasses SPA routing so middleware runs a full
    // auth check. Without this, the middleware may see a stale cookie
    // and redirect right back to the dashboard — never letting the
    // user actually re-authenticate.
    window.location.href = '/crm-login';
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
      <div className="text-center p-8 max-w-md">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
          Unable to Load CRM
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          There was a problem loading this page. This could be due to a connection issue or a temporary problem.
        </p>
        {error.digest && (
          <p className="text-xs text-slate-400 mb-4 font-mono">
            Error ID: {error.digest}
          </p>
        )}
        <div className="space-y-3">
          <button
            onClick={handleTryAgain}
            disabled={retrying}
            className="w-full px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {retrying ? 'Retrying…' : 'Try again'}
          </button>
          <button
            onClick={handleGoToLogin}
            className="block w-full px-6 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    </div>
  );
}
