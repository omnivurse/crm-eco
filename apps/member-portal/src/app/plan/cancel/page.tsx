'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Warning } from '@phosphor-icons/react';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui';
import { createClient } from '@crm-eco/lib/supabase/client';
import { PageHeader } from '@/components/PageHeader';

interface InactiveReason {
  code: string;
  description: string;
  category: string | null;
}

export default function PlanCancelPage() {
  const router = useRouter();
  const [reasons, setReasons] = useState<InactiveReason[]>([]);
  const [reasonCode, setReasonCode] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from('inactive_reasons')
        .select('code, description, category')
        .in('category', ['cancellation', 'non_payment', 'plan_change', 'other']);
      setReasons(data ?? []);
    }
    load();
  }, []);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/member/change-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_type: 'cancel_membership',
          payload: {
            reason_code: reasonCode,
            requested_effective_date: effectiveDate || null,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'request_failed');
      setSuccess(true);
      setTimeout(() => router.push('/plan'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="py-12 text-center">
            <p className="text-emerald-900">
              Your cancellation request has been submitted. Our team will reach out shortly.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <PageHeader
        title="Cancel membership"
        description="We're sorry to see you go. Cancellation requests are reviewed by our team before becoming final."
        backHref="/plan"
        backLabel="Back to Plan"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cancellation details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Reason</label>
            <select
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select a reason...</option>
              {reasons.map((r) => (
                <option key={r.code} value={r.code}>{r.description}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Requested effective date
            </label>
            <input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-slate-500">
              Defaults to the end of your current billing period if blank.
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              disabled={!reasonCode}
              className="w-full rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue
            </button>
          ) : (
            <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <Warning weight="light" className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
                <div className="flex-1">
                  <p className="font-semibold text-red-900">
                    Are you sure you want to cancel?
                  </p>
                  <p className="mt-1 text-sm text-red-700">
                    Your request will be reviewed before becoming final. Billing will continue
                    until the cancellation is approved.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Yes, cancel my membership'}
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Go back
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
