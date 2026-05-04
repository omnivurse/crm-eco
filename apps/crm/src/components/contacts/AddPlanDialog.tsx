'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@crm-eco/ui/components/dialog';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { toast } from 'sonner';

const PLAN_TYPES = ['insurance', 'healthshare', 'medicaid', 'short_term'] as const;
const METAL_LEVELS = ['', 'catastrophic', 'bronze', 'silver', 'gold', 'platinum'] as const;

type PlanType = (typeof PLAN_TYPES)[number];
type MetalLevel = (typeof METAL_LEVELS)[number];

interface AddPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  carrierId: string;
  carrierName: string;
  defaultPlanType?: PlanType;
  onCreated: () => void;
}

interface FormState {
  plan_name: string;
  plan_type: PlanType;
  metal_level: MetalLevel;
  base_premium: string;
  deductible: string;
  max_out_of_pocket: string;
  copay_primary: string;
  copay_specialist: string;
  plan_year: string;
  summary_url: string;
  rx_coverage: boolean;
  dental_included: boolean;
  vision_included: boolean;
  hsa_eligible: boolean;
}

const EMPTY_FORM: FormState = {
  plan_name: '',
  plan_type: 'insurance',
  metal_level: '',
  base_premium: '',
  deductible: '',
  max_out_of_pocket: '',
  copay_primary: '',
  copay_specialist: '',
  plan_year: '',
  summary_url: '',
  rx_coverage: true,
  dental_included: false,
  vision_included: false,
  hsa_eligible: false,
};

function toNumberOrUndef(v: string): number | undefined {
  const n = Number(v);
  return v.trim() === '' || Number.isNaN(n) ? undefined : n;
}

export function AddPlanDialog({
  open,
  onOpenChange,
  carrierId,
  carrierName,
  defaultPlanType,
  onCreated,
}: AddPlanDialogProps) {
  const [form, setForm] = useState<FormState>({
    ...EMPTY_FORM,
    plan_type: defaultPlanType ?? EMPTY_FORM.plan_type,
  });
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function reset() {
    setForm({ ...EMPTY_FORM, plan_type: defaultPlanType ?? EMPTY_FORM.plan_type });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.plan_name.trim()) {
      toast.error('Plan name is required');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        plan_name: form.plan_name.trim(),
        plan_type: form.plan_type,
        rx_coverage: form.rx_coverage,
        dental_included: form.dental_included,
        vision_included: form.vision_included,
        hsa_eligible: form.hsa_eligible,
      };
      if (form.metal_level) payload.metal_level = form.metal_level;
      const num = (k: keyof FormState) => toNumberOrUndef(form[k] as string);
      const base_premium = num('base_premium');
      const deductible = num('deductible');
      const max_out_of_pocket = num('max_out_of_pocket');
      const copay_primary = num('copay_primary');
      const copay_specialist = num('copay_specialist');
      const plan_year = num('plan_year');
      if (base_premium !== undefined) payload.base_premium = base_premium;
      if (deductible !== undefined) payload.deductible = deductible;
      if (max_out_of_pocket !== undefined) payload.max_out_of_pocket = max_out_of_pocket;
      if (copay_primary !== undefined) payload.copay_primary = copay_primary;
      if (copay_specialist !== undefined) payload.copay_specialist = copay_specialist;
      if (plan_year !== undefined) payload.plan_year = Math.trunc(plan_year);
      if (form.summary_url.trim()) payload.summary_url = form.summary_url.trim();

      const res = await fetch(`/api/crm/carriers/${carrierId}/plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        const msg =
          typeof json.error === 'string'
            ? json.error
            : Array.isArray(json.error)
              ? json.error.map((e: { message?: string }) => e.message).filter(Boolean).join('; ')
              : 'Failed to create plan';
        toast.error(msg);
        return;
      }

      toast.success(`Plan added to ${carrierName}`);
      reset();
      onOpenChange(false);
      onCreated();
    } catch {
      toast.error('Failed to create plan');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-[95vw] max-w-2xl sm:max-w-2xl max-h-[90vh] sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add plan to {carrierName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label htmlFor="plan_name">Plan name *</Label>
              <Input
                id="plan_name"
                value={form.plan_name}
                onChange={(e) => update('plan_name', e.target.value)}
                placeholder="e.g. Bronze HSA 5000"
                required
              />
            </div>
            <div>
              <Label htmlFor="plan_type">Plan type</Label>
              <select
                id="plan_type"
                value={form.plan_type}
                onChange={(e) => update('plan_type', e.target.value as PlanType)}
                className="flex h-10 w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {PLAN_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace('_', '-')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="metal_level">Metal level</Label>
              <select
                id="metal_level"
                value={form.metal_level}
                onChange={(e) => update('metal_level', e.target.value as MetalLevel)}
                className="flex h-10 w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {METAL_LEVELS.map((m) => (
                  <option key={m} value={m}>
                    {m || '— none —'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="base_premium">Monthly premium ($)</Label>
              <Input
                id="base_premium"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={form.base_premium}
                onChange={(e) => update('base_premium', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="deductible">Deductible ($)</Label>
              <Input
                id="deductible"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={form.deductible}
                onChange={(e) => update('deductible', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="max_out_of_pocket">Max out-of-pocket ($)</Label>
              <Input
                id="max_out_of_pocket"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={form.max_out_of_pocket}
                onChange={(e) => update('max_out_of_pocket', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="plan_year">Plan year</Label>
              <Input
                id="plan_year"
                type="number"
                inputMode="numeric"
                min={2000}
                max={2099}
                step="1"
                value={form.plan_year}
                onChange={(e) => update('plan_year', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="copay_primary">Primary copay ($)</Label>
              <Input
                id="copay_primary"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={form.copay_primary}
                onChange={(e) => update('copay_primary', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="copay_specialist">Specialist copay ($)</Label>
              <Input
                id="copay_specialist"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={form.copay_specialist}
                onChange={(e) => update('copay_specialist', e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="summary_url">Plan summary URL</Label>
              <Input
                id="summary_url"
                type="url"
                value={form.summary_url}
                onChange={(e) => update('summary_url', e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-white/10">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.rx_coverage}
                onChange={(e) => update('rx_coverage', e.target.checked)}
              />
              Rx coverage
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.dental_included}
                onChange={(e) => update('dental_included', e.target.checked)}
              />
              Dental included
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.vision_included}
                onChange={(e) => update('vision_included', e.target.checked)}
              />
              Vision included
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.hsa_eligible}
                onChange={(e) => update('hsa_eligible', e.target.checked)}
              />
              HSA eligible
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…
                </>
              ) : (
                'Create plan'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
