'use client';

import { useEffect } from 'react';
import { Button } from '@/components/primitives/Button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.error(error);
    }
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-helix-fog">
          DH/ERR · UNEXPECTED
        </p>
        <h1 className="display-2 mt-4">Something broke a strand.</h1>
        <p className="mt-3 text-sm text-helix-mist">
          An unexpected error occurred while rendering this page. Reload to try again.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button variant="primary" onClick={() => reset()}>
            Try again
          </Button>
          <Button href="/" variant="ghost">
            Back to home
          </Button>
        </div>
      </div>
    </div>
  );
}
