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
      <h2 className="text-xl font-semibold text-slate-900">Something went wrong</h2>
      <p className="text-sm text-slate-500">An unexpected error occurred. Please try again.</p>
      <button
        onClick={reset}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
