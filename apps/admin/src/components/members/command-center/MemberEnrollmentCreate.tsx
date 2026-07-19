'use client';

import { CircleNotch, FilePlus } from '@phosphor-icons/react';
/**
 * MemberEnrollmentCreate — admin "create manual enrollment" control.
 * For back-office / edge situations where staff must enroll a member by hand.
 * Calls adminCreateEnrollment → the canonical create_enrollment_tx RPC (same
 * primitive as every other create path). Creates a draft enrollment; approve it
 * from the enrollment detail to generate the membership + billing schedule.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { toast } from 'sonner';
import { adminCreateEnrollment } from '@/app/(dashboard)/members/[id]/command-actions';

type Plan = { id: string; name: string; plan_type: string | null; monthly_share: number | null };

export function MemberEnrollmentCreate({
  memberId,
  availablePlans,
}: {
  memberId: string;
  availablePlans: Plan[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [planId, setPlanId] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  async function onCreate() {
    if (!planId) return toast.error('Select a plan');
    setSaving(true);
    try {
      const res = await adminCreateEnrollment({
        member_id: memberId,
        plan_id: planId,
        effective_date: effectiveDate,
      });
      if (!res.success) {
        toast.error(res.error ?? 'Failed to create enrollment');
        return;
      }
      const replay = (res.data as { idempotentReplay?: boolean } | undefined)?.idempotentReplay;
      toast.success(replay ? 'Existing enrollment found (no duplicate created)' : 'Draft enrollment created');
      if (res.billingError) toast.warning(`Created, but billing may be briefly out of date: ${res.billingError}`);
      setOpen(false);
      const enrollmentId = (res.data as { enrollmentId?: string } | undefined)?.enrollmentId;
      if (enrollmentId) router.push(`/enrollments/${enrollmentId}`);
      else router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex justify-end">
        <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
          <FilePlus weight="light" className="h-4 w-4" />
          Create enrollment
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create manual enrollment</DialogTitle>
            <DialogDescription>
              Creates a draft enrollment for this member via the canonical enrollment engine.
              Approve it from the enrollment detail to activate the membership &amp; billing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Plan</label>
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  {availablePlans.length === 0 ? (
                    <SelectItem value="__none" disabled>No active plans in catalog</SelectItem>
                  ) : (
                    availablePlans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                        {p.plan_type ? ` (${p.plan_type})` : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Effective date</label>
              <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={onCreate} disabled={saving || !planId}>
              {saving && <CircleNotch weight="light" className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
