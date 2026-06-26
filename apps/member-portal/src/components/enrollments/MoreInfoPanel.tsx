'use client';

/**
 * MoreInfoPanel (SLICE E5) — applicant-facing more-info reader + responder.
 * ----------------------------------------------------------------
 * Rendered on the member enrollment surface when status === 'more_info'. It
 * shows the latest admin more_info_request (body + the list of requested fields)
 * plus any prior applicant_response rows, and provides a textarea that calls the
 * respondMoreInfo server action. On success the enrollment returns to 'submitted'
 * and the parent surface re-renders (revalidatePath in the action), which removes
 * this panel.
 *
 * Data is supplied by getApplicantReviews (apps/portal/src/lib/data/moreInfo.ts),
 * which already verified ownership and projected only applicant-visible rows.
 */

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, Button, Textarea, Badge } from '@crm-eco/ui';
import { AlertTriangle, MessageSquare, Send, CheckCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { respondMoreInfo } from '@/app/enroll/actions';
import type { ApplicantReview } from '@/lib/data/moreInfo';

interface MoreInfoPanelProps {
  enrollmentId: string;
  reviews: ApplicantReview[];
}

export function MoreInfoPanel({ enrollmentId, reviews }: MoreInfoPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [response, setResponse] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // The most recent admin request, and the applicant's prior replies (oldest first).
  const { latestRequest, priorResponses } = useMemo(() => {
    const requests = reviews.filter((r) => r.kind === 'more_info_request');
    const responses = reviews.filter((r) => r.kind === 'applicant_response');
    return {
      latestRequest: requests.length ? requests[requests.length - 1] : null,
      priorResponses: responses,
    };
  }, [reviews]);

  const submit = () => {
    const body = response.trim();
    if (!body) {
      setError('Please enter a response before submitting.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await respondMoreInfo(enrollmentId, body);
      if (!result.success) {
        setError(
          result.error === 'not_awaiting_input'
            ? 'This enrollment is no longer awaiting your input — please refresh to see its current status.'
            : result.error === 'Access denied'
              ? 'You do not have access to respond to this enrollment.'
              : result.error || 'Something went wrong. Please try again.',
        );
        return;
      }
      setSuccess(true);
      setResponse('');
      // The action revalidates the surface; refresh so the panel disappears once
      // the enrollment is back to 'submitted'.
      router.refresh();
    });
  };

  return (
    <Card className="border-amber-200 bg-amber-50/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg text-amber-900">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          More Information Needed
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* The admin's request */}
        {latestRequest ? (
          <div className="rounded-lg border border-amber-200 bg-white p-4">
            <p className="text-xs font-medium text-amber-700 mb-1">
              Request from our team
              {latestRequest.created_at && (
                <span className="ml-2 font-normal text-slate-400">
                  {format(new Date(latestRequest.created_at), 'MMM d, yyyy h:mm a')}
                </span>
              )}
            </p>
            {latestRequest.body && (
              <p className="text-sm text-slate-700 whitespace-pre-wrap">
                {latestRequest.body}
              </p>
            )}
            {latestRequest.requested_fields.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-slate-500 mb-1">Please provide:</p>
                <div className="flex flex-wrap gap-1.5">
                  {latestRequest.requested_fields.map((f) => (
                    <Badge
                      key={f}
                      className="bg-amber-100 text-amber-800 border border-amber-200"
                    >
                      {f}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-amber-200 bg-white p-4">
            <p className="text-sm text-slate-700">
              Our team has requested additional information for this enrollment.
              Please add any details below.
            </p>
          </div>
        )}

        {/* Prior applicant responses */}
        {priorResponses.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-500">Your previous responses</p>
            {priorResponses.map((r) => (
              <div
                key={r.id}
                className="rounded-lg border border-slate-200 bg-white p-3"
              >
                <p className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                  <MessageSquare className="w-3 h-3" />
                  {r.created_at
                    ? format(new Date(r.created_at), 'MMM d, yyyy h:mm a')
                    : 'You'}
                </p>
                {r.body && (
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{r.body}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Response form */}
        {success ? (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <p className="text-sm text-green-800">
              Thanks — your response was submitted and your enrollment is back under
              review.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <label htmlFor="more-info-response" className="text-sm font-medium text-slate-700">
              Your response
            </label>
            <Textarea
              id="more-info-response"
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="Provide the requested information here…"
              rows={4}
              disabled={isPending}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end">
              <Button onClick={submit} disabled={isPending || !response.trim()} className="gap-2">
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit Response
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
