'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui';

const REQUEST_TYPES = [
  { value: 'add_dependent', label: 'Add a dependent' },
  { value: 'remove_dependent', label: 'Remove a dependent' },
  { value: 'upgrade_plan', label: 'Upgrade plan tier' },
  { value: 'downgrade_plan', label: 'Downgrade plan tier' },
  { value: 'change_iua', label: 'Change IUA level' },
  { value: 'change_effective_date', label: 'Change effective date' },
  { value: 'other', label: 'Other' },
] as const;

export default function PlanChangePage() {
  const router = useRouter();
  const [requestType, setRequestType] = useState<typeof REQUEST_TYPES[number]['value']>('add_dependent');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/member/change-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_type: requestType,
          payload: { notes, submitted_via: 'portal' },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'request_failed');
      setSuccess(true);
      setTimeout(() => router.push('/plan'), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <Link href="/plan" className="inline-flex items-center text-sm text-blue-600 hover:underline">
        <ChevronLeft className="mr-1 h-4 w-4" /> Back to Plan
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Request a plan change</h1>
        <p className="mt-1 text-sm text-slate-600">
          Submit a request and your advisor will follow up within one business day.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change request</CardTitle>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              Your request was submitted. Your advisor will contact you within 1 business day.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  What would you like to change?
                </label>
                <select
                  value={requestType}
                  onChange={(e) => setRequestType(e.target.value as typeof requestType)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {REQUEST_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Details
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={5}
                  required
                  placeholder="Describe what you'd like to change..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !notes.trim()}
                className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit request'}
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
