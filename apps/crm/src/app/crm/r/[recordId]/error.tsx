'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, RotateCcw } from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';

export default function RecordDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[RecordDetail] Error loading record:', {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center p-8 max-w-md">
        <div className="w-14 h-14 mx-auto mb-5 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-amber-600 dark:text-amber-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          Unable to load this record
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
          There was a problem loading the record details. This is usually a temporary issue.
        </p>
        {error.digest && (
          <p className="text-xs text-slate-400 mb-4 font-mono">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" asChild>
            <Link href="/crm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to CRM
            </Link>
          </Button>
          <Button onClick={() => reset()}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
