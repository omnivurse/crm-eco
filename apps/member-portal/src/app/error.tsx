'use client';

import { useEffect } from 'react';
import { Warning, ArrowsClockwise, House } from '@phosphor-icons/react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Portal Error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <Warning weight="light" className="h-8 w-8 text-red-600" />
        </div>
        <h2 className="mb-3 text-2xl font-bold tracking-[-0.03em] text-[var(--mp-ink)]">
          Something went wrong
        </h2>
        <p className="mb-6 text-slate-600">
          An unexpected error occurred. Please try again or return to the home page.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-full border border-[rgba(11,109,133,0.15)] px-4 py-2 text-slate-700 transition-colors hover:bg-[rgba(11,109,133,0.04)]"
          >
            <ArrowsClockwise weight="light" className="h-4 w-4" />
            Try Again
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--mp-teal)] px-4 py-2 text-white transition-opacity hover:opacity-90"
          >
            <House weight="light" className="h-4 w-4" />
            Go Home
          </Link>
        </div>
        {error.digest && (
          <p className="mt-4 text-xs text-slate-400">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
