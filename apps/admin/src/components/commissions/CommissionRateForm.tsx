'use client';

import { CircleNotch, FloppyDisk } from '@phosphor-icons/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Switch,
} from '@crm-eco/ui';
import { EntityPageHeader } from '@/components/ui/EntityPageHeader';

const rateFormSchema = z.object({
  notes: z.string().optional(),
  signup_commission: z.number().min(0).optional(),
  signup_commission_percent: z.number().min(0).max(100).optional(),
  monthly_commission: z.number().min(0).optional(),
  monthly_commission_percent: z.number().min(0).max(100).optional(),
  override_commission_percent: z.number().min(0).max(100).optional(),
  effective_date: z.string().min(1, 'Effective date is required'),
  end_date: z.string().optional(),
  is_active: z.boolean(),
});

type RateFormData = z.infer<typeof rateFormSchema>;

interface CommissionRate {
  id: string;
  notes: string | null;
  signup_commission: number | null;
  signup_commission_percent: number | null;
  monthly_commission: number | null;
  monthly_commission_percent: number | null;
  override_commission_percent: number | null;
  effective_date: string | null;
  end_date: string | null;
  is_active: boolean | null;
}

interface CommissionRateFormProps {
  rate?: CommissionRate;
  organizationId: string;
}

export function CommissionRateForm({ rate, organizationId }: CommissionRateFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const isEdit = !!rate;

  const form = useForm<RateFormData>({
    resolver: zodResolver(rateFormSchema),
    defaultValues: {
      notes: rate?.notes ?? '',
      signup_commission: rate?.signup_commission ?? 0,
      signup_commission_percent: rate?.signup_commission_percent ?? 0,
      monthly_commission: rate?.monthly_commission ?? 0,
      monthly_commission_percent: rate?.monthly_commission_percent ?? 0,
      override_commission_percent: rate?.override_commission_percent ?? 0,
      effective_date: rate?.effective_date ?? new Date().toISOString().slice(0, 10),
      end_date: rate?.end_date ?? '',
      is_active: rate?.is_active ?? true,
    },
  });

  const onSubmit = async (values: RateFormData) => {
    setSaving(true);
    try {
      const payload = {
        organization_id: organizationId,
        notes: values.notes || null,
        signup_commission: values.signup_commission ?? 0,
        signup_commission_percent: values.signup_commission_percent ?? 0,
        monthly_commission: values.monthly_commission ?? 0,
        monthly_commission_percent: values.monthly_commission_percent ?? 0,
        override_commission_percent: values.override_commission_percent ?? 0,
        effective_date: values.effective_date,
        end_date: values.end_date || null,
        is_active: values.is_active,
      };

      if (isEdit) {
        const { error } = await (supabase.from('commission_rates') as any)
          .update(payload)
          .eq('id', rate.id)
          .eq('organization_id', organizationId);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from('commission_rates') as any).insert(payload);
        if (error) throw error;
      }

      toast.success(isEdit ? 'Rate updated' : 'Rate created');
      router.push('/commissions/rates');
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Failed to save rate');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <EntityPageHeader
        title={isEdit ? 'Edit commission rate' : 'New commission rate'}
        backHref="/commissions/rates"
      />
      <Card>
        <CardHeader>
          <CardTitle>Rate card</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Label</Label>
              <Input id="notes" placeholder="Default PIFH rate" {...form.register('notes')} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="signup_commission_percent">Signup percent</Label>
                <Input
                  id="signup_commission_percent"
                  type="number"
                  step="0.01"
                  {...form.register('signup_commission_percent', { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup_commission">Signup flat amount</Label>
                <Input
                  id="signup_commission"
                  type="number"
                  step="0.01"
                  {...form.register('signup_commission', { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="monthly_commission_percent">Monthly percent</Label>
                <Input
                  id="monthly_commission_percent"
                  type="number"
                  step="0.01"
                  {...form.register('monthly_commission_percent', { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="override_commission_percent">Override percent</Label>
                <Input
                  id="override_commission_percent"
                  type="number"
                  step="0.01"
                  {...form.register('override_commission_percent', { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="effective_date">Effective date</Label>
                <Input id="effective_date" type="date" {...form.register('effective_date')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End date</Label>
                <Input id="end_date" type="date" {...form.register('end_date')} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.watch('is_active')}
                onCheckedChange={(checked) => form.setValue('is_active', checked)}
              />
              <Label>Active</Label>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <CircleNotch className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FloppyDisk className="h-4 w-4 mr-2" />
              )}
              Save rate
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
