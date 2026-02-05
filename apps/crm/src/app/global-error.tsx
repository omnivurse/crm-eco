'use client';

/**
 * Global Error Handler
 * Catches unhandled errors in the app and prevents white screen crashes
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Log the error with digest for server log correlation
  console.error('Global error caught:', {
    message: error.message,
    digest: error.digest,
    stack: error.stack,
  });

  return (
    <html>
      <body className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center p-8 max-w-md">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            Something went wrong
          </h2>
          <p className="text-slate-600 mb-6">
            An unexpected error occurred. Please try again.
          </p>
          {error.digest && (
            <p className="text-xs text-slate-400 mb-4 font-mono">
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={() => reset()}
            className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
