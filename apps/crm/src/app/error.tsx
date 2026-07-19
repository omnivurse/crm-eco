'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Something went wrong</h2>
      <p className="max-w-md text-center text-sm text-slate-500 dark:text-slate-400">
        {error?.message?.trim()
          ? error.message
          : 'An unexpected error occurred. Please try again.'}
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-slate-400">Error ID: {error.digest}</p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700"
        >
          Try again
        </button>
        <a
          href="/crm-login"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Go to Login
        </a>
      </div>
    </div>
  );
}
