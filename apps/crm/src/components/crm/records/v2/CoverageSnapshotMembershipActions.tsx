'use client';

/**
 * Current + upcoming membership actions on the coverage snapshot.
 * Schedule change opens the shared plan-change dialog; Cancel hits the
 * unified schedule-membership-change API.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpCircle, CalendarClock, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { Button } from '@crm-eco/ui/components/button';
import { toastCopy } from '@/lib/crm/toast-copy';
import { parseScheduledPlanChange } from '@/lib/crm/scheduled-plan-change-apply';
import {
  ChangeFormDialog,
  type MembershipChange,
} from './MembershipChangeHistory';
import type { BillingPlanOption } from '@/lib/crm/schedule-membership-change';

function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), 'MMM d, yyyy');
  } catch {
    return iso;
  }
}

export function CoverageSnapshotMembershipActions({
  recordId,
  recordTitle,
  data,
  canEdit,
}: {
  recordId: string;
  recordTitle: string;
  data: Record<string, unknown> | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [plans, setPlans] = useState<BillingPlanOption[]>([]);
  const [hasActiveCore, setHasActiveCore] = useState(false);

  const scheduled = parseScheduledPlanChange(data);

  useEffect(() => {
    if (!dialogOpen) return;
    let cancelled = false;
    void fetch(`/api/crm/records/${recordId}/schedule-membership-change`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { plans?: BillingPlanOption[]; has_active_core?: boolean } | null) => {
        if (cancelled || !json) return;
        setPlans(Array.isArray(json.plans) ? json.plans : []);
        setHasActiveCore(Boolean(json.has_active_core));
      })
      .catch(() => {
        /* picker stays text-only */
      });
    return () => {
      cancelled = true;
    };
  }, [dialogOpen, recordId]);

  const handleSave = useCallback(
    async (change: MembershipChange) => {
      const res = await fetch(`/api/crm/records/${recordId}/schedule-membership-change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: change.type,
          effective_date: change.date,
          ...(change.from_plan && { from_plan: change.from_plan }),
          ...(change.to_plan && { to_plan: change.to_plan }),
          ...(change.from_iua && { from_iua: change.from_iua }),
          ...(change.to_iua && { to_iua: change.to_iua }),
          ...(change.from_monthly && { from_monthly: change.from_monthly }),
          ...(change.to_monthly && { to_monthly: change.to_monthly }),
          ...(change.notes && { notes: change.notes }),
          ...(change.plan_id && { plan_id: change.plan_id }),
          change_id: change.id,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        warning?: string;
        lane?: string;
      };
      if (!res.ok) {
        toast.error(toastCopy.failed('schedule the membership change', json.error, 'Try again'));
        throw new Error(json.error || 'Schedule failed');
      }
      toast.success(toastCopy.saved('Scheduled membership change'), {
        description:
          json.warning ||
          (json.lane === 'mms' || json.lane === 'mms_immediate'
            ? 'Billing membership will switch on the effective date. Current plan stays until then.'
            : `Current membership stays until ${formatDate(change.date)}, then Product, IUA and monthly update.`),
      });
      setDialogOpen(false);
      router.refresh();
    },
    [recordId, router],
  );

  const handleCancel = useCallback(async () => {
    setCancelling(true);
    try {
      const res = await fetch(`/api/crm/records/${recordId}/schedule-membership-change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(toastCopy.failed('cancel the scheduled change', json.error, 'Try again'));
        return;
      }
      toast.success(toastCopy.deleted('Scheduled membership change'));
      router.refresh();
    } finally {
      setCancelling(false);
    }
  }, [recordId, router]);

  if (!canEdit && !scheduled) return null;

  return (
    <div
      className="mt-2 flex flex-wrap items-center gap-2"
      data-testid="crm-snapshot-membership-actions"
    >
      {scheduled?.effective_date ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300">
          <CalendarClock className="h-3.5 w-3.5 shrink-0" />
          Upcoming: {scheduled.to_plan || 'plan change'} · starts{' '}
          {formatDate(scheduled.effective_date)}
          {canEdit ? (
            <button
              type="button"
              onClick={() => void handleCancel()}
              disabled={cancelling}
              className="ml-0.5 rounded-full p-0.5 hover:bg-amber-500/20"
              aria-label="Cancel scheduled membership change"
            >
              {cancelling ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <X className="h-3 w-3" />
              )}
            </button>
          ) : null}
        </span>
      ) : canEdit ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() => setDialogOpen(true)}
          data-testid="crm-schedule-membership-change"
        >
          <ArrowUpCircle className="h-3.5 w-3.5" />
          Schedule change
        </Button>
      ) : null}

      {dialogOpen ? (
        <ChangeFormDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSave={async (change) => {
            await handleSave(change);
          }}
          currentData={data}
          billingPlans={hasActiveCore ? plans : []}
          dialogTitle="Schedule a membership change"
          submitLabel="Schedule change"
        />
      ) : null}
      <span className="sr-only">{recordTitle}</span>
    </div>
  );
}
