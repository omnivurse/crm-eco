'use client';

import { Warning, ArrowsClockwise } from '@phosphor-icons/react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8">
      <div className="mb-2 grid h-14 w-14 place-items-center rounded-[0.85rem] bg-[var(--adv-sage-soft)]">
        <Warning weight="light" className="h-7 w-7 text-[var(--adv-teal)]" aria-hidden />
      </div>
      <h2 className="adv-display text-xl font-semibold tracking-[-0.02em] text-[var(--adv-ink)]">
        Something went wrong
      </h2>
      <p className="text-sm text-[var(--adv-slate)]">
        An unexpected error occurred. Please try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="inline-flex items-center gap-2 rounded-full bg-[var(--adv-ink)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        <ArrowsClockwise weight="light" className="h-4 w-4" aria-hidden />
        Try again
      </button>
      {error.digest && (
        <p className="mt-2 text-xs text-[var(--adv-slate)]/60">Error ID: {error.digest}</p>
      )}
    </div>
  );
}
