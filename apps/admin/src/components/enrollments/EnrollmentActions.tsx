'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { guaranteedUpdateWithVersion } from '@crm-eco/lib';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
  Input,
} from '@crm-eco/ui';
import {
  MoreVertical,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  MessageSquare,
} from 'lucide-react';
import {
  approveEnrollment,
  rejectEnrollment,
  requestMoreInfo,
  type DecideEnrollmentResult,
} from '@/app/(dashboard)/enrollments/actions';

interface EnrollmentActionsProps {
  enrollmentId: string;
  currentStatus: string;
}

/**
 * Admin enrollment decision menu.
 *
 * Decision writes now go through the `'use server'` actions in
 * `app/(dashboard)/enrollments/actions.ts` (cookie/SSR client, RLS-gated,
 * role-checked via getActiveTenant) instead of the previous browser-side
 * dual write. The server action keeps the optimistic-concurrency guarantee
 * (guaranteedUpdateWithVersion), resolves the parallel `enrollment_approvals`
 * row, writes the `enrollment_reviews` thread, and the `enrollment_audit_log`
 * entry in one consistent (tenant, profile) pass, then revalidates the page.
 */
export function EnrollmentActions({ enrollmentId, currentStatus }: EnrollmentActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Reject dialog state (reason required).
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Request-more-info dialog state (message required + optional fields list).
  const [moreInfoOpen, setMoreInfoOpen] = useState(false);
  const [moreInfoMessage, setMoreInfoMessage] = useState('');
  const [moreInfoFields, setMoreInfoFields] = useState('');

  const handleResult = (result: DecideEnrollmentResult) => {
    if (!result.ok) {
      const msg =
        result.error === 'conflict'
          ? (result.message ??
            'This enrollment was just edited by someone else — refresh and try again.')
          : result.error === 'reason_required'
            ? 'A reason is required for this action.'
            : result.error === 'forbidden'
              ? 'You do not have permission to perform this action.'
              : (result.message ?? `Action failed (${result.error}).`);
      if (typeof window !== 'undefined') alert(msg);
      return;
    }
    router.refresh();
  };

  const runApprove = () => {
    startTransition(async () => {
      const result = await approveEnrollment(enrollmentId, undefined, undefined, currentStatus);
      handleResult(result);
    });
  };

  const submitReject = () => {
    const reason = rejectReason.trim();
    if (!reason) return;
    startTransition(async () => {
      const result = await rejectEnrollment(enrollmentId, reason, undefined, currentStatus);
      handleResult(result);
      if (result.ok) {
        setRejectOpen(false);
        setRejectReason('');
      }
    });
  };

  const submitMoreInfo = () => {
    const message = moreInfoMessage.trim();
    if (!message) return;
    const fields = moreInfoFields
      .split(/[\n,]/)
      .map((f) => f.trim())
      .filter(Boolean);
    startTransition(async () => {
      const result = await requestMoreInfo(
        enrollmentId,
        fields,
        message,
        undefined,
        currentStatus,
      );
      handleResult(result);
      if (result.ok) {
        setMoreInfoOpen(false);
        setMoreInfoMessage('');
        setMoreInfoFields('');
      }
    });
  };

  // Operational (non-decision) transitions — Reopen / Cancel — keep their existing
  // optimistic-concurrency browser path. They carry no approval/decision record, so
  // they intentionally do NOT route through the decision server actions; only the
  // status flips (audit handled DB-side by log_enrollment_status_change()).
  const runOperationalStatus = (newStatus: string) => {
    startTransition(async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const result = await guaranteedUpdateWithVersion(
        supabase,
        'enrollments',
        enrollmentId,
        { status: newStatus },
        { orgColumn: 'organization_id' },
      );
      if (!result.ok) {
        if (typeof window !== 'undefined') alert(result.error);
        return;
      }
      router.refresh();
    });
  };

  // Approvable / rejectable now also includes the new review states so an
  // enrollment parked in pending_review (auto-routed) or more_info (awaiting the
  // enrollee) can be decided. more_info can also be requested from those states.
  const canApprove = ['submitted', 'in_progress', 'pending_review', 'more_info'].includes(
    currentStatus,
  );
  const canReject = ['submitted', 'in_progress', 'pending_review', 'more_info'].includes(
    currentStatus,
  );
  const canRequestMoreInfo = ['submitted', 'in_progress', 'pending_review'].includes(
    currentStatus,
  );
  const canCancel = !['cancelled', 'rejected'].includes(currentStatus);
  const canReopen = ['rejected', 'cancelled'].includes(currentStatus);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" disabled={isPending}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreVertical className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canApprove && (
            <DropdownMenuItem onClick={runApprove} className="text-green-600">
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve Enrollment
            </DropdownMenuItem>
          )}
          {canRequestMoreInfo && (
            <DropdownMenuItem onClick={() => setMoreInfoOpen(true)}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Request More Info
            </DropdownMenuItem>
          )}
          {canReject && (
            <DropdownMenuItem
              onClick={() => setRejectOpen(true)}
              className="text-red-600"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject Enrollment
            </DropdownMenuItem>
          )}
          {canReopen && (
            <DropdownMenuItem onClick={() => runOperationalStatus('in_progress')}>
              <Clock className="h-4 w-4 mr-2" />
              Reopen as In Progress
            </DropdownMenuItem>
          )}
          {(canApprove || canReject || canRequestMoreInfo || canReopen) && canCancel && (
            <DropdownMenuSeparator />
          )}
          {canCancel && (
            <DropdownMenuItem
              onClick={() => runOperationalStatus('cancelled')}
              className="text-red-600"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancel Enrollment
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Reject dialog — reason required */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Enrollment</DialogTitle>
            <DialogDescription>
              Provide a reason. This is recorded on the enrollment and the approval
              record for the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Reason</Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Why is this enrollment being rejected?"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={submitReject}
              disabled={isPending || !rejectReason.trim()}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request-more-info dialog — message required, applicant-visible */}
      <Dialog open={moreInfoOpen} onOpenChange={setMoreInfoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request More Info</DialogTitle>
            <DialogDescription>
              This message is visible to the applicant. The enrollment moves to
              “More Info Needed” until they respond.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="more-info-message">Message to applicant</Label>
              <Textarea
                id="more-info-message"
                value={moreInfoMessage}
                onChange={(e) => setMoreInfoMessage(e.target.value)}
                placeholder="What additional information do you need from the applicant?"
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="more-info-fields">
                Fields to request (optional, comma or newline separated)
              </Label>
              <Input
                id="more-info-fields"
                value={moreInfoFields}
                onChange={(e) => setMoreInfoFields(e.target.value)}
                placeholder="e.g. date_of_birth, proof_of_address"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMoreInfoOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={submitMoreInfo} disabled={isPending || !moreInfoMessage.trim()}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
