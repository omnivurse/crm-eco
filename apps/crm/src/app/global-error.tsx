'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="max-w-md p-8 text-center">
          <h2 className="mb-4 text-2xl font-bold text-slate-900">Something went wrong</h2>
          <p className="mb-6 text-slate-600">An unexpected error occurred. Please try again.</p>
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg bg-slate-800 px-6 py-3 text-white hover:bg-slate-700"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
