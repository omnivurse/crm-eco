import Link from 'next/link';
import { AlertTriangle, ChevronLeft, RefreshCcw, MessageCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui';
import { listOpenFailures } from '@/lib/data/billing';

export const dynamic = 'force-dynamic';

export default async function BillingFailuresPage() {
  const failures = await listOpenFailures();

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <Link href="/billing" className="inline-flex items-center text-sm text-blue-600 hover:underline">
        <ChevronLeft className="mr-1 h-4 w-4" /> Back to Billing
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Payment Failures</h1>
        <p className="mt-1 text-sm text-slate-600">
          Resolve unsuccessful charges to keep your membership active.
        </p>
      </div>

      {failures.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-500">No outstanding failures. You&apos;re all caught up.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {failures.map((f) => (
            <Card key={f.id} className="border-red-200">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-red-900">
                  <AlertTriangle className="h-5 w-5" />
                  ${Number(f.amount).toFixed(2)} — {f.failure_reason}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                  <div>
                    <dt className="text-slate-500">Attempt</dt>
                    <dd className="font-medium text-slate-900">{f.retry_attempt}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Next retry</dt>
                    <dd className="font-medium text-slate-900">
                      {f.next_retry_date
                        ? new Date(f.next_retry_date).toLocaleDateString()
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Status</dt>
                    <dd className="font-medium text-slate-900">{f.status ?? 'open'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Code</dt>
                    <dd className="font-medium text-slate-900">{f.failure_code ?? '—'}</dd>
                  </div>
                </dl>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Link
                    href="/billing"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    <RefreshCcw className="h-3.5 w-3.5" />
                    Update payment method
                  </Link>
                  <Link
                    href="/support?topic=billing-failure"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Contact support
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
