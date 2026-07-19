'use client';

import { ArrowClockwise, CircleNotch, Package, Plus, XCircle } from '@phosphor-icons/react';
/**
 * MemberProductsPanel — staff management of a member's plan/product.
 * Reads memberships (the source of truth) and writes via admin plan actions
 * (command-actions → @crm-eco/lib memberPlan, service-role conduit + recalc).
 * A member has at most one active membership: assign (when none), change, or end.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';
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
import { format } from 'date-fns';
import { toast } from 'sonner';
import { adminAssignPlan, adminChangePlan, adminEndPlan } from '@/app/(dashboard)/members/[id]/command-actions';

type Plan = { id: string; name: string; code: string | null; plan_type: string | null; monthly_share: number | null };
type Membership = Record<string, unknown> & { id: string; status: string };

interface Props {
  memberId: string;
  memberships: Membership[];
  availablePlans: Plan[];
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function fmtMoney(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function statusVariant(s: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (s === 'active') return 'default';
  if (s === 'pending' || s === 'paused') return 'secondary';
  if (s === 'terminated') return 'destructive';
  return 'outline';
}

function planLabel(p: Plan) {
  const price = p.monthly_share != null ? ` — ${fmtMoney(p.monthly_share)}/mo` : '';
  return `${p.name}${p.plan_type ? ` (${p.plan_type})` : ''}${price}`;
}

export function MemberProductsPanel({ memberId, memberships, availablePlans }: Props) {
  const router = useRouter();
  const active = memberships.find((m) => m.status === 'active') ?? null;

  const [mode, setMode] = useState<null | 'assign' | 'change' | 'end'>(null);
  const [planId, setPlanId] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  function close() {
    setMode(null);
    setPlanId('');
    setEffectiveDate(todayIso());
    setEndDate(todayIso());
    setReason('');
  }

  function surface(result: { success: boolean; error?: string; billingError?: string; billing?: { previousAmount: number; newAmount: number } }, ok: string) {
    if (!result.success) {
      toast.error(result.error ?? 'Action failed');
      return false;
    }
    const b = result.billing;
    const billingMsg = b && b.previousAmount !== b.newAmount ? ` Billing: ${fmtMoney(b.previousAmount)} → ${fmtMoney(b.newAmount)}/mo.` : '';
    toast.success(`${ok}${billingMsg}`);
    if (result.billingError) {
      toast.warning(`Saved, but billing may be briefly out of date: ${result.billingError}`);
    }
    return true;
  }

  async function onAssign() {
    if (!planId) return toast.error('Select a plan');
    setSaving(true);
    try {
      const res = await adminAssignPlan({ member_id: memberId, plan_id: planId, effective_date: effectiveDate });
      if (surface(res, 'Plan assigned')) {
        close();
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function onChange() {
    if (!active) return;
    if (!planId) return toast.error('Select a plan');
    setSaving(true);
    try {
      const res = await adminChangePlan({ member_id: memberId, membership_id: active.id, plan_id: planId });
      if (surface(res, 'Plan changed')) {
        close();
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function onEnd() {
    if (!active) return;
    setSaving(true);
    try {
      const res = await adminEndPlan({ member_id: memberId, membership_id: active.id, end_date: endDate, reason: reason || undefined });
      if (surface(res, 'Plan ended')) {
        close();
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Package weight="light" className="h-5 w-5" />
            Plan &amp; Products
          </CardTitle>
          <CardDescription>
            Source of truth: <code className="text-xs">memberships</code> → <code className="text-xs">plans</code>. Changes recalculate billing.
          </CardDescription>
        </div>
        {!active && (
          <Button size="sm" onClick={() => setMode('assign')} className="gap-2 shrink-0">
            <Plus weight="light" className="h-4 w-4" />
            Assign plan
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Active plan */}
        {active ? (
          <div className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">
                  {((active.plans as Record<string, unknown> | null)?.name as string) ?? 'Plan'}
                </p>
                <p className="text-sm text-slate-500">
                  Effective {active.effective_date ? format(new Date(active.effective_date as string), 'MMM d, yyyy') : '—'}
                  {active.end_date ? ` → ${format(new Date(active.end_date as string), 'MMM d, yyyy')}` : ''}
                </p>
              </div>
              <div className="text-right">
                <Badge variant={statusVariant(active.status)}>{active.status}</Badge>
                <p className="mt-1 text-sm">{fmtMoney(active.billing_amount)}/mo</p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" className="gap-2" onClick={() => { setPlanId(''); setMode('change'); }}>
                <ArrowClockwise weight="light" className="h-4 w-4" />
                Change plan
              </Button>
              <Button size="sm" variant="outline" className="gap-2 text-red-600" onClick={() => setMode('end')}>
                <XCircle weight="light" className="h-4 w-4" />
                End plan
              </Button>
            </div>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed p-4 text-sm text-slate-500">
            No active plan. Use “Assign plan” to add one.
          </p>
        )}

        {/* History (non-active memberships) */}
        {memberships.filter((m) => m.id !== active?.id).length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">History</p>
            {memberships
              .filter((m) => m.id !== active?.id)
              .map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <div>
                    <p className="font-medium">{((m.plans as Record<string, unknown> | null)?.name as string) ?? 'Plan'}</p>
                    <p className="text-slate-500">
                      {m.effective_date ? format(new Date(m.effective_date as string), 'MMM d, yyyy') : '—'}
                      {m.end_date ? ` → ${format(new Date(m.end_date as string), 'MMM d, yyyy')}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant={statusVariant(m.status)}>{m.status}</Badge>
                    <p className="mt-1">{fmtMoney(m.billing_amount)}/mo</p>
                  </div>
                </div>
              ))}
          </div>
        )}
      </CardContent>

      {/* Assign / Change dialog */}
      <Dialog open={mode === 'assign' || mode === 'change'} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === 'assign' ? 'Assign plan' : 'Change plan'}</DialogTitle>
            <DialogDescription>
              {mode === 'assign'
                ? 'Create an active membership for this member. Billing recalculates from the plan + covered dependents.'
                : 'Switch the active membership to a different plan. Billing recalculates.'}
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
                      <SelectItem key={p.id} value={p.id}>{planLabel(p)}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            {mode === 'assign' && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Effective date</label>
                <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={saving}>Cancel</Button>
            <Button onClick={mode === 'assign' ? onAssign : onChange} disabled={saving || !planId}>
              {saving && <CircleNotch weight="light" className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'assign' ? 'Assign' : 'Change'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* End dialog */}
      <Dialog open={mode === 'end'} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End plan</DialogTitle>
            <DialogDescription>
              Terminate the active membership. Billing recalculates (typically to $0 once no active plan remains).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">End date</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Reason (optional)</label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. cancelled, switched plan" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={saving}>Cancel</Button>
            <Button variant="destructive" onClick={onEnd} disabled={saving}>
              {saving && <CircleNotch weight="light" className="mr-2 h-4 w-4 animate-spin" />}
              End plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
