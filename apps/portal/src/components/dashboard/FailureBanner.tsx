import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';

interface FailureBannerProps {
  count: number;
}

export function FailureBanner({ count }: FailureBannerProps) {
  if (count <= 0) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
      <div className="flex-1">
        <p className="font-semibold text-red-900">
          {count === 1 ? 'A payment failed' : `${count} payments failed`}
        </p>
        <p className="mt-1 text-sm text-red-700">
          Update your payment method or contact support to keep your membership active.
        </p>
      </div>
      <Link
        href="/billing/failures"
        className="inline-flex items-center gap-1 self-center rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
      >
        Resolve
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
